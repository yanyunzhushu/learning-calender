# 常见问题排查

## 页面空白 / 加载不出来

1. 确认运行服务的终端窗口仍然打开；Windows 可双击 `start-windows.cmd`，Mac 可运行 `pnpm dev`
2. 如果构建文件缺失，启动入口会自动构建；更新源码后先运行 `pnpm build`，再重启服务
3. 检查浏览器控制台（F12 → Console）是否有错误
4. 尝试清除浏览器缓存

## 数据丢失

**可能原因**：

- 清除了浏览器数据/缓存
- 使用了隐私模式/无痕浏览（会话结束后数据被清除）
- 手动执行了 `localStorage.removeItem('calendar-app-state')`

**预防措施**：

定期导出数据（F12 → Console）：

```js
console.log(localStorage.getItem('calendar-app-state'))
```

将输出的 JSON 字符串保存到本地文件。

也可以使用顶部「备份」保存到项目 `backups/` 并从文件恢复。切换电脑、浏览器、浏览器用户配置、`localhost`/`127.0.0.1` 或端口会看到另一份数据，请回到原浏览器和地址导出备份。

## 新建任务按钮没反应

对话框通常会在点击后立即弹出。如果没反应：

1. 检查浏览器控制台是否有 JavaScript 错误
2. 尝试刷新页面（数据保存在 localStorage，刷新不会丢失）
3. 如果持续出现，可能是 `localStorage` 数据损坏，尝试导出→清空→重新导入

## 端口 3000 被占用

`scripts/serve.mjs` 会自动处理端口冲突：
- 端口空闲 → 直接启动
- 被同一项目的健康服务器占用 → 复用
- 被其他服务或旧版日程服务占用 → 显示启动失败，不结束其他进程

先在原服务终端按 `Ctrl+C`，再重新启动；升级前运行的旧版服务也需要停止。若不知道占用者，可查看监听进程：

```bash
# macOS
lsof -iTCP:3000 -sTCP:LISTEN
```

```bat
rem Windows 命令提示符
netstat -ano | findstr :3000
```

Windows 可根据 PID 在任务管理器中确认对应程序后关闭。请保持端口 3000，切换端口会使用不同的浏览器存储。

## Windows 启动失败

- 提示找不到 Node.js：安装 Node.js LTS 后重新打开终端或启动入口；最低版本为 20.9.0。
- 提示缺少依赖：在项目目录执行 `pnpm install`。不要复制 Mac 的 `node_modules/`。
- PowerShell 阻止 `pnpm.ps1`：使用 `pnpm.cmd`，或在命令提示符中执行。
- 双击后有错误提示：窗口会暂停，按提示修复后重试；重复启动成功复用服务时，新窗口会正常退出，首次启动的窗口仍须保留。
- 浏览器未自动打开：手动访问 `http://localhost:3000`。
- 备份提示无法写入：把项目放到本机可写目录，检查 `backups/` 权限。

## 构建失败

```bash
pnpm build    # 查看具体错误信息
```

常见原因：
- `out/` 目录权限问题 → `rm -rf out && pnpm build`
- 依赖丢失 → `pnpm install && pnpm build`

TypeScript 类型错误不会阻止构建（配置了 `ignoreBuildErrors: true`）。

## 任务不显示

1. 确认任务在对应日期范围内
2. 检查是否开启了**假期模式**（周期/进度任务在假期区间内不显示）
3. 检查是否启用了**任务视图**（聚焦模式）——仅显示被聚焦任务
4. 检查任务是否被**暂停**（paused 的任务不生成今天之后的实例）
5. 持续进度任务：未来日期不会生成实例，仅显示到今天为止

## 样式错乱

1. 确保运行 `pnpm build`（而非 `pnpm dev:next`）来验证最终构建
2. CSS 依赖 Tailwind v4，确保 `postcss.config.mjs` 配置存在
3. 清除浏览器缓存后重试
