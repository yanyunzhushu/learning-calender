# 部署流程

当前项目用于个人本地使用，保留 Next.js 静态导出和浏览器/PWA 运行方式。GitHub Actions 提供 macOS/Windows 兼容检查，不会自动部署网站。

## 当前构建方式

```bash
pnpm build          # 构建静态文件到 out/
pnpm dev            # 启动本地静态服务器 (localhost:3000)
```

`pnpm build` 执行 `next build`，输出到 `out/` 目录（纯 HTML/CSS/JS）。

## 静态文件服务器

`scripts/serve.mjs` 提供本地 HTTP 服务：
- 端口 3000
- 自动打开浏览器
- 只监听本机，浏览器固定使用 `http://localhost:3000`
- 同一项目的健康服务可复用；其他服务或旧版服务占用端口时明确报错
- Windows 可双击根目录的 `start-windows.cmd`，首次缺少页面构建产物时自动构建

## 兼容验证

`.github/workflows/compatibility.yml` 在 macOS 和 Windows 上执行 `pnpm install --frozen-lockfile`、`pnpm test:server` 和 `pnpm build`，Windows 另验证双击入口使用的 `.cmd` 脚本。PWA 安装和浏览器界面需实机验证。

## 可能的部署方式

由于 `out/` 目录为纯静态文件，可部署到任何静态托管服务：

- **GitHub Pages** — 将 `out/` 推送到 `gh-pages` 分支
- **Vercel** — 直接部署 Next.js 项目（需移除 `output: 'export'`）
- **Netlify** — 上传 `out/` 目录
- **本地使用** — `pnpm dev` 或 Windows 启动入口，通过 HTTP 访问；请勿用 `file://` 直接打开 `out/index.html`

## Tauri 迁移

参见 CLAUDE.md 中的「迁移到 Tauri 的路线图」。Tauri 迁移后部署方式变为独立的 `.app` 桌面应用，双击即用。
