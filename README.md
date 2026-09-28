# learning calender

个人日历任务管理应用，支持五种任务类型（日常任务、周期任务、复习任务、持续进度任务、长期任务）和三种视图模式（月/周/日）。支持 macOS 和 Windows，继续使用本地 HTTP 服务 + 浏览器/PWA，数据存储在浏览器 localStorage 中。

## 环境要求

- **Node.js** ≥ 20.9.0（推荐受支持的 LTS 版本；与 Next.js 16 要求一致）
- **pnpm** ≥ 9

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动应用（自动构建 + 打开浏览器）
pnpm dev
```

启动后浏览器会自动打开 `http://localhost:3000`。如果没有自动打开，手动访问即可。

保持运行服务的终端窗口打开，按 `Ctrl+C` 停止。已有同一项目的服务运行时，会复用该服务。

## Windows 使用

1. 安装 Node.js LTS，并重新打开终端，使 PATH 生效。
2. 获取或解压项目到本机可写目录（不要复制 Mac 上的 `node_modules/`）。
3. 在项目目录打开命令提示符（文件资源管理器地址栏输入 `cmd`），首次执行：

```bat
npm install -g pnpm@10
pnpm install
```

4. 双击项目根目录的 `start-windows.cmd`，或运行 `pnpm dev`。缺少 `out/index.html` 时会先构建，然后打开浏览器。启动失败会显示原因并保留窗口。
5. 保持首次启动的服务窗口打开；停止时在该窗口按 `Ctrl+C`。更新源码后运行 `pnpm build`，再重启服务并刷新页面。

PowerShell 如果提示 `pnpm.ps1` 无法执行，可直接使用 `pnpm.cmd install`、`pnpm.cmd dev`、`pnpm.cmd build`，无需修改执行策略。

在 Windows Edge/Chrome 中可以把页面安装为应用、固定到任务栏；macOS 可使用浏览器的安装/添加到 Dock 功能。当前 PWA 没有离线缓存，使用时仍需保持本地服务运行。

## 数据与备份

- 日常使用固定访问 `http://localhost:3000`，保持同一浏览器和用户配置。更换浏览器、主机名或端口会使用另一份 localStorage。
- 顶部「备份」将 JSON 写入项目的 `backups/`，恢复前先保存当前数据；请将项目放在有写入权限的目录。
- 在 Mac 和 Windows 间迁移时，从原电脑保存备份，再在新电脑导入。两台电脑不会自动同步数据。
- 端口被其他服务或旧版日程服务占用时会明确报错，请停止对应服务后重试；不会自动结束其他进程。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 构建静态文件 + 启动服务器 + 打开浏览器 |
| `pnpm build` | 仅构建静态文件（输出到 `out/`） |
| `pnpm dev:next` | Next.js 开发模式（Turbopack 热更新，适合 UI 开发） |
| `pnpm test:server` | 本地服务兼容与备份测试（Node.js 内置测试，无新增依赖） |
| `pnpm lint` | 运行 ESLint（当前未安装 ESLint，命令无法正常运行） |

## 技术栈

Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui

## 项目结构

```
lib/              # 核心逻辑（任务引擎、日期工具、类型定义）
components/       # UI 组件（日历视图、任务表单、对话框）
scripts/serve.mjs # 轻量静态服务器（支持 Windows / macOS / Linux）
start-windows.cmd # Windows 双击启动入口
out/              # 构建产物（pnpm build 生成）
docs/             # 详细文档
```

GitHub Actions 在 macOS 和 Windows 上运行服务测试与构建，并在 Windows 上验证启动入口。浏览器安装 PWA、中文输入法及实际界面仍需实机确认。
