# 测试指南

当前未配置应用业务/组件测试框架。本地服务使用 Node.js 内置测试运行器，无新增测试依赖。

## 当前验证方式

1. `pnpm test:server` — 验证本地启动、中文/空格路径、备份、服务复用及端口冲突
2. `pnpm build` — 验证构建是否成功
3. 浏览器中手动确认功能是否正常

服务测试在临时目录使用独立端口，不接触用户的任务、`out/` 或 `backups/`。首次构建测试使用临时 CLI 验证真实子进程调用；完整 Next 构建由 `pnpm build` 验证。

GitHub Actions 在 macOS 和 Windows 上运行上述检查，并在 Windows 验证 `start-windows.cmd`。CI 通过不代表已经人工确认浏览器/PWA 操作。

## Windows 实机检查

1. 全新获取源码并安装依赖，双击 `start-windows.cmd`，确认首次构建、自动打开浏览器和中文输出。
2. 从中文/含空格目录启动，重复双击应复用原服务。
3. 创建任务、完成/撤销、刷新，确认数据保留；在月/周/日视图中检查布局及中文输入。
4. 保存 JSON 到 `backups/`，确认恢复前备份和 Mac/Windows 间导入。
5. 在 Edge/Chrome 安装为应用，确认服务运行时可打开；停止服务后当前版本不提供离线启动。

## 测试数据注入

详细说明见 CLAUDE.md 中的「测试数据」章节。

**方式 A：控制台脚本**
在对话中生成测试数据脚本 → 粘贴到 F12 控制台 → 页面自动刷新。

**方式 B：临时硬编码**
在 `use-app-state.ts` 中临时写入 `localStorage.setItem(...)` → 构建 → 用户刷新后回退代码。

**清空数据**：
```js
localStorage.removeItem('calendar-app-state');
location.reload();
```

## 未来方向

如需添加测试框架，推荐方案：

- **单元测试**: Vitest（与 TypeScript + React 兼容性好）
- **组件测试**: React Testing Library
- **端到端测试**: Playwright（适合验证日历交互流程）

核心纯函数（`lib/task-engine.ts`、`lib/date-utils.ts`）不含 React 依赖，可以直接用 Vitest 进行单元测试，无需额外配置。
