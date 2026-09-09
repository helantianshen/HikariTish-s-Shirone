# 后台开发服务器

- 更新时间：2026-09-07（Asia/Shanghai）。
- 目标：保持 Shirone 开发服务器在后台运行，支持当前会话的实时查看与修改。
- 启动命令：`pnpm.cmd astro dev --host 0.0.0.0 --port 4321`
- 工作目录：`E:/front_end/Shirone`
- 访问地址：`http://localhost:4321/`；局域网地址由 Astro 启动日志提供。
- 当前监听端口：`4321`。批量更新文章摘要后为刷新 Astro 内容缓存，已在 2026-09-07 停止原 PID `20132` 并启动新 PID `26896`；后续仍以端口和 `astro dev status` 为准。
- 日志：`.agent/runtime/astro-dev.log`（本地运行产物，不是源码或验证结论）。

## 实际验证

- 本机 Windows PowerShell 环境中启动成功。
- `http://localhost:4321/` 返回 HTTP 200。
- 当前未运行生产构建、Astro check、Playwright 或其他代码质量门禁；本任务只负责启动开发服务器。

## 操作边界

- 后续修改源码后由 Astro dev 热更新；若遇到 Markdown 或 Stylus/Svelte 缓存问题，按 `PROJECT.md` 与开发技能中的清理规则处理。
- 停止服务可在项目目录执行 `pnpm.cmd astro dev stop`；不要误杀其他 Node 进程。
