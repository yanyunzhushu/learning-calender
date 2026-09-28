#!/usr/bin/env node
/**
 * 轻量级静态文件服务器
 * 提供 Next.js static export (`out/`) 的静态资源。
 *
 * - 端口空闲 → 直接启动（毫秒级就绪）
 * - 端口被同一项目的健康服务器占用 → 复用并打开浏览器
 * - 端口被其他进程占用 → 提示用户处理，不强制结束进程
 * - out/ 不存在 → 自动构建
 * - 服务器就绪后自动打开浏览器
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import { spawn, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const ROOT = path.join(PROJECT_ROOT, 'out')
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups')
const MAX_BACKUP_BYTES = 10 * 1024 * 1024
const PORT = Number(process.env.PORT || '3000')
const PROJECT_ID = createHash('sha256')
  .update(process.platform === 'win32' ? PROJECT_ROOT.toLowerCase() : PROJECT_ROOT)
  .digest('hex')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

function serveFile(res, filePath) {
  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
    return true
  } catch {
    return false
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

/** 备份只接受来自当前本地页面的请求，其他网站不能借浏览器写入本机。 */
function isLocalBackupRequest(req) {
  const host = req.headers.host
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && [`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`].includes(host)
    && req.headers.origin === `http://${host}`
}

async function saveBackup(req, res) {
  if (!isLocalBackupRequest(req)) {
    sendJson(res, 403, { error: '仅允许从本地日程页面保存备份。' })
    return
  }
  const kind = req.headers['x-calendar-backup']
  if (!['manual', 'before-restore'].includes(kind) || req.headers['content-type']?.split(';')[0] !== 'application/json') {
    sendJson(res, 415, { error: '备份请求格式无效。' })
    return
  }
  if (Number(req.headers['content-length']) > MAX_BACKUP_BYTES) {
    sendJson(res, 413, { error: '备份超过 10 MB，未保存。' })
    return
  }

  try {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BACKUP_BYTES) {
        sendJson(res, 413, { error: '备份超过 10 MB，未保存。' })
        return
      }
      chunks.push(chunk)
    }
    const content = Buffer.concat(chunks).toString('utf8')
    let backup
    try {
      backup = JSON.parse(content)
    } catch {
      sendJson(res, 400, { error: '备份不是有效的 JSON。' })
      return
    }
    if (backup?.version !== 1 || !Array.isArray(backup.state?.tasks) || !Array.isArray(backup.state?.holidays)) {
      sendJson(res, 400, { error: '备份内容无效。' })
      return
    }

    await fs.promises.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 })
    const prefix = kind === 'manual' ? '日程安排备份' : '恢复前备份'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${prefix}-${timestamp}-${randomBytes(4).toString('hex')}.json`
    await fs.promises.writeFile(path.join(BACKUP_DIR, fileName), content, { flag: 'wx', mode: 0o600 })
    sendJson(res, 201, { saved: true, fileName })
  } catch (error) {
    console.error('保存本地备份失败:', error)
    sendJson(res, 500, { error: '无法写入项目备份目录。' })
  }
}

function handle(req, res) {
  let url
  try {
    url = decodeURIComponent(req.url.split('?')[0]).replaceAll('\\', '/')
    if (!url.startsWith('/') || url.includes('\0')) throw new Error('非法路径')
  } catch {
    res.writeHead(400)
    res.end('Bad Request')
    return
  }

  if (url === '/__local/backup/status' && req.method === 'GET') {
    sendJson(res, 200, { service: 'calendar-local-backup', projectId: PROJECT_ID })
    return
  }
  if (url === '/__local/backup') {
    if (req.method === 'POST') void saveBackup(req, res)
    else sendJson(res, 405, { error: '仅支持 POST。' })
    return
  }

  let filePath = path.resolve(ROOT, `.${url}`)
  const relative = path.relative(ROOT, filePath)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (url === '/') filePath = path.join(ROOT, 'index.html')
  if (serveFile(res, filePath)) return

  if (!path.posix.extname(url) && url !== '/') {
    if (serveFile(res, path.join(filePath, 'index.html'))) return
  }

  // 页面导航可回到首页；缺失的 JS/CSS 等资源必须返回 404。
  if (!path.posix.extname(url) && serveFile(res, path.join(ROOT, 'index.html'))) return

  res.writeHead(404)
  res.end('Not Found')
}

// ---------- 运行环境与构建 ----------

function ensureBuild() {
  if (fs.existsSync(path.join(ROOT, 'index.html'))) return
  const nextCli = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
  if (!fs.existsSync(nextCli)) {
    throw new Error('缺少项目依赖，请先在项目目录运行 pnpm install。')
  }
  console.log('构建静态文件…')
  // 使用当前 Node 直接执行本地 CLI，兼容 Windows 的 .cmd 及含空格的路径。
  const result = spawnSync(process.execPath, [nextCli, 'build'], { cwd: PROJECT_ROOT, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0 || !fs.existsSync(path.join(ROOT, 'index.html'))) {
    throw new Error('构建失败，请运行 pnpm build 查看错误。')
  }
  console.log('构建完成。')
}

/** 检查端口上的 HTTP 服务是否正常响应 */
async function isHealthy() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/__local/backup/status`, { signal: AbortSignal.timeout(1000) })
    if (!res.ok) return false
    const status = await res.json()
    return status.service === 'calendar-local-backup' && status.projectId === PROJECT_ID
  } catch {
    return false
  }
}

// ---------- 跨平台工具 ----------

function openBrowser(url) {
  if (process.env.CI || process.env.OPEN_BROWSER === 'false') return
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  // Windows 的 start 是 cmd 内置命令；URL 只包含固定主机和已校验端口。
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', `"start "" "${url}""`] : [url]
  const child = spawn(command, args, {
    stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: process.platform === 'win32',
  })
  child.on('error', () => console.warn(`无法自动打开浏览器，请手动访问 ${url}`))
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.warn(`无法自动打开浏览器，请手动访问 ${url}`)
  })
  child.unref()
}

// ---------- 启动 ----------

async function start() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 20 || (major === 20 && minor < 9)) {
    throw new Error(`需要 Node.js >= 20.9.0，当前为 ${process.versions.node}。请安装受支持的 Node.js LTS。`)
  }
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT 必须是 1 到 65535 之间的整数。')
  }
  ensureBuild()
  const server = http.createServer(handle)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    // 仅监听本机；浏览器地址保持 localhost，继续使用原来的 localStorage。
    server.listen(PORT, '127.0.0.1', resolve)
  }).catch(async (error) => {
    if (error.code !== 'EADDRINUSE') throw error
    if (!await isHealthy()) {
      throw new Error(`端口 ${PORT} 已被其他服务或旧版日程服务占用。请先在原终端按 Ctrl+C 停止对应服务后重试；程序不会强制结束其他进程。`)
    }
    console.log(`已复用本项目的日程服务：http://localhost:${PORT}`)
  })

  if (server.listening) {
    console.log(`Server ready on http://localhost:${PORT}`)
    console.log('请保持此窗口打开；按 Ctrl+C 停止服务。')
  }
  openBrowser(`http://localhost:${PORT}/`)
}

start().catch((error) => {
  console.error(`启动失败：${error.message}`)
  process.exitCode = 1
})
