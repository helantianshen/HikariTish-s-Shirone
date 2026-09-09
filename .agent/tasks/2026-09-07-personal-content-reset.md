# 个人页面内容清理与友链替换

- 更新时间：2026-09-07（Asia/Shanghai）。
- 目标：清空动态、时间线、关于与相册的示例内容，并以用户提供的六个博客替换原友链。
- 状态：已完成；开发服务已重启并加载最新内容。

## 最终内容

- 动态：删除 6 个 Markdown 条目和 4 个专用图片目录；保留空目录占位与页面空状态。
- 时间线：删除 5 个示例节点；保留配置、页面和空状态。
- 关于：保留 `src/content/spec/about.md` 内容入口，正文为空。
- 相册：删除 `AcgExample`、`EncryptedExample`、`ExternalExample`、`HiddenExample` 四个示例目录；保留相册数据契约文档和空状态，原详情路由返回 404。
- 友链：删除 Mizuki、Astro、Material 3 三条示例数据，加入用户指定的 6 个博客。
- 友链图片：六个站点公开 logo/favicon 均已缓存到 `public/assets/friends/`，页面不依赖外部头像请求。

## 修改范围

- `src/content/moments/`、`public/images/moments/`
- `src/data/timeline.ts`
- `src/content/spec/about.md`
- `public/images/albums/`
- `src/data/friends.ts`、`public/assets/friends/`
- `tests/site/{friends,moments,timeline,albums,about,a11y}.spec.ts`
- `public/images/albums/README.md`

## 验证

- `pnpm.cmd exec biome ci`（本次 TypeScript 数据与测试文件）：通过。
- `pnpm.cmd exec astro check`：240 个文件，0 errors / 0 warnings / 0 hints；空动态集合仅产生预期的 glob-loader 提示。
- 五个页面专项 Playwright：8/8 通过，覆盖六条友链、搜索/标签、四页空状态、关于正文为空、旧相册路由 404。
- 五个页面浅色/深色 axe 扫描：10/10 通过。
- 真实 Chrome：6/6 个友链本地图片加载成功，旧示例友链链接为 0。
- `/friends/`、`/moments/`、`/timeline/`、`/albums/`、`/about/` 均返回 HTTP 200。

## 运行状态与授权

- 后台 Astro 开发服务已重启，当前监听 PID 为 `17832`，地址为 `http://localhost:4321/`。
- 未执行暂存、Commit、Push、PR 或部署。
