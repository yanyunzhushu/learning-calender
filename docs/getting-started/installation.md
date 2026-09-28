# 安装与配置指南

## 环境要求

| 工具 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 20.9.0 | 受支持的 LTS |
| pnpm | 9.x | 10.x |

## 安装步骤

### 1. 克隆仓库

```bash
git clone <仓库地址>
cd learning_calender
```

### 2. 安装依赖

```bash
pnpm install
```

主要依赖包括：

- **Next.js 16** — 框架（Static Export 模式）
- **React 19** — UI 库
- **Tailwind CSS 4** — 样式框架
- **shadcn/ui** — 组件库
- **lucide-react** — 图标

完整清单见 `package.json`。

Windows 可在文件资源管理器的项目地址栏输入 `cmd` 打开命令提示符。请在 Windows 上重新安装依赖，不要复制其他系统的 `node_modules/`。

### 3. 验证安装

```bash
pnpm build        # 构建静态文件到 out/
pnpm dev          # 启动本地服务
```

Windows 完成首次 `pnpm install` 后，也可以双击根目录的 `start-windows.cmd`。缺少 `out/index.html` 时会自动构建。项目放在本机可写目录，服务窗口需要保持打开，按 `Ctrl+C` 停止。

在 Edge/Chrome 中安装为应用后仍需要本地服务运行，当前 Service Worker 没有离线缓存。Mac 的运行命令和数据存储方式保持一致。

## 常见安装问题

### pnpm 未安装

```bash
npm install -g pnpm@10
```

PowerShell 若提示 `pnpm.ps1` 被执行策略阻止，使用 `pnpm.cmd install` 和 `pnpm.cmd dev`，或者切换到命令提示符。

### 端口 3000 被占用

`pnpm dev` 的启动脚本（`scripts/serve.mjs`）会自动处理：
- 端口空闲 → 直接启动
- 已被同一项目的健康服务器占用 → 复用，不重复启动
- 被其他服务或旧版日程服务占用 → 显示错误，不强制结束进程

先在对应服务的原终端按 `Ctrl+C` 停止，再重新启动。日常保持 `http://localhost:3000`，避免因切换主机名或端口而使用不同的浏览器存储。

## 更新与数据迁移

更新源码后执行 `pnpm install`、`pnpm build`，重启本地服务并刷新页面。重新构建不会清除浏览器 localStorage。

Mac 与 Windows 间通过顶部「备份」导出的 JSON 迁移数据；新电脑导入前会备份当前数据并提示替换。数据不会随源码或 Git 自动同步。详见[备份与恢复](../operations/backup.md)。

### 构建失败（TypeScript 错误）

项目配置了 `typescript.ignoreBuildErrors: true`，TypeScript 类型错误不会阻止构建。如遇其他构建错误，检查 `out/` 目录权限。

## 开发模式

如需热更新开发体验（Next.js Turbopack）：

```bash
pnpm dev:next
```

此模式适合频繁修改代码时使用，修改会实时反映到浏览器。
