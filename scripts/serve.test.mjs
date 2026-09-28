import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('./serve.mjs', import.meta.url))

async function fixture(t, { built = true } = {}) {
  // 每次在含中文和空格的临时目录测试，不接触用户的 out/ 和 backups/。
  const root = await fs.mkdtemp(path.join(os.tmpdir(), '日程 Windows path '))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'scripts'))
  await fs.copyFile(script, path.join(root, 'scripts', 'serve.mjs'))
  if (built) {
    await fs.mkdir(path.join(root, 'out'))
    await fs.writeFile(path.join(root, 'out', 'index.html'), '<h1>日程安排</h1>')
    await fs.writeFile(path.join(root, 'out', 'app.js'), 'console.log("日程安排")')
  }
  return root
}

async function freePort() {
  const server = http.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

function launch(t, root, port) {
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'serve.mjs')], {
    cwd: os.tmpdir(),
    env: { ...process.env, PORT: String(port), OPEN_BROWSER: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  const completion = once(child, 'close').then(([code]) => code)
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill()
    await completion
  })
  return { child, completion, output: () => output }
}

async function ready(process, port) {
  for (let i = 0; i < 200; i++) {
    if (process.child.exitCode !== null) throw new Error(process.output())
    try {
      const response = await fetch(`http://127.0.0.1:${port}/__local/backup/status`, {
        signal: AbortSignal.timeout(250),
      })
      if (response.ok) return
    } catch { /* 等待服务启动 */ }
    await delay(50)
  }
  throw new Error(`服务启动超时：${process.output()}`)
}

test('静态资源、中文备份、来源限制及重复启动', { timeout: 20000 }, async (t) => {
  const root = await fixture(t)
  const port = await freePort()
  const process = launch(t, root, port)
  await ready(process, port)
  const base = `http://127.0.0.1:${port}`
  const page = await fetch(`http://localhost:${port}/`)
  assert.match(await page.text(), /日程安排/)
  const js = await fetch(`${base}/app.js`)
  assert.match(js.headers.get('content-type'), /javascript/)
  assert.equal((await fetch(`${base}/missing.js`)).status, 404)
  await fs.mkdir(path.join(root, 'out', '中文页面'))
  await fs.writeFile(path.join(root, 'out', '中文页面', 'index.html'), 'nested page')
  assert.equal(await (await fetch(`${base}/中文页面/`)).text(), 'nested page')

  const backup = {
    version: 1,
    exportedAt: '2026-09-28T00:00:00.000Z',
    state: { tasks: [{ id: 'sample', name: '中文任务' }], holidays: [], groups: [], themes: [], trash: [], holidayModeEnabled: false },
  }
  const headers = { 'Content-Type': 'application/json', 'X-Calendar-Backup': 'manual', Origin: `http://localhost:${port}` }
  const response = await fetch(`http://localhost:${port}/__local/backup`, { method: 'POST', headers, body: JSON.stringify(backup) })
  assert.equal(response.status, 201)
  const saved = await response.json()
  assert.match(saved.fileName, /^日程安排备份-.*\.json$/)
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'backups', saved.fileName), 'utf8')), backup)
  assert.equal((await fetch(`${base}/__local/backup`, {
    method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: JSON.stringify(backup),
  })).status, 403)
  assert.equal((await fetch(`http://localhost:${port}/__local/backup`, {
    method: 'POST', headers, body: '{broken',
  })).status, 400)
  const beforeRestore = await fetch(`http://localhost:${port}/__local/backup`, {
    method: 'POST', headers: { ...headers, 'X-Calendar-Backup': 'before-restore' }, body: JSON.stringify(backup),
  })
  assert.equal(beforeRestore.status, 201)
  assert.match((await beforeRestore.json()).fileName, /^恢复前备份-/)

  const second = launch(t, root, port)
  assert.equal(await second.completion, 0)
  assert.match(second.output(), /已复用本项目/)
  assert.equal((await fetch(base)).status, 200)
})

test('其他服务占用端口时明确退出，保持原服务运行', { timeout: 10000 }, async (t) => {
  const root = await fixture(t)
  const occupied = http.createServer((req, res) => res.end('existing service'))
  occupied.listen(0, '127.0.0.1')
  await once(occupied, 'listening')
  t.after(() => new Promise((resolve) => occupied.close(resolve)))
  const port = occupied.address().port
  const process = launch(t, root, port)
  assert.equal(await process.completion, 1)
  assert.match(process.output(), /端口.*已被/)
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'existing service')
})

test('另一份项目不能复用当前项目的备份服务', { timeout: 15000 }, async (t) => {
  const root = await fixture(t)
  const other = await fixture(t)
  const port = await freePort()
  await ready(launch(t, root, port), port)
  const process = launch(t, other, port)
  assert.equal(await process.completion, 1)
  assert.match(process.output(), /端口.*已被/)
})

test('拒绝越界的 Windows 路径及损坏的 URL', { timeout: 10000 }, async (t) => {
  const root = await fixture(t)
  const port = await freePort()
  await ready(launch(t, root, port), port)
  await fs.writeFile(path.join(root, 'secret.txt'), 'private')
  const base = `http://127.0.0.1:${port}`
  assert.equal((await fetch(`${base}/..%5csecret.txt`)).status, 403)
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400)
})

test('首次构建通过本地 Node CLI 支持中文和空格目录', { timeout: 10000 }, async (t) => {
  const root = await fixture(t, { built: false })
  const bin = path.join(root, 'node_modules', 'next', 'dist', 'bin')
  await fs.mkdir(bin, { recursive: true })
  // 替代耗时的 Next 构建，验证真实子进程的路径、工作目录和参数。
  await fs.writeFile(path.join(bin, 'next'), `
    const fs = require('node:fs');
    if (process.argv[2] !== 'build') process.exit(2);
    fs.mkdirSync('out');
    fs.writeFileSync('out/index.html', '<h1>built</h1>');
  `)
  const port = await freePort()
  const process = launch(t, root, port)
  await ready(process, port)
  assert.match(process.output(), /构建完成/)
  assert.match(await (await fetch(`http://127.0.0.1:${port}`)).text(), /built/)
})

test('缺少依赖或端口无效时给出可操作的错误', { timeout: 10000 }, async (t) => {
  const root = await fixture(t, { built: false })
  const missing = launch(t, root, await freePort())
  assert.equal(await missing.completion, 1)
  assert.match(missing.output(), /pnpm install/)
  const invalid = launch(t, root, '3000abc')
  assert.equal(await invalid.completion, 1)
  assert.match(invalid.output(), /PORT 必须/)
})

test('Windows 启动入口支持中文/空格目录及不同工作目录', {
  skip: process.platform !== 'win32', timeout: 15000,
}, async (t) => {
  const root = await fixture(t)
  const launcher = path.join(root, 'start-windows.cmd')
  await fs.copyFile(fileURLToPath(new URL('../start-windows.cmd', import.meta.url)), launcher)
  const port = await freePort()
  await ready(launch(t, root, port), port)
  const child = spawn('cmd.exe', ['/d', '/s', '/c', `""${launcher}""`], {
    cwd: os.tmpdir(), windowsVerbatimArguments: true,
    env: { ...process.env, CI: 'true', PORT: String(port), OPEN_BROWSER: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  const completion = once(child, 'close')
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill() })
  assert.equal((await completion)[0], 0, output)
  assert.match(output, /已复用本项目/)
})
