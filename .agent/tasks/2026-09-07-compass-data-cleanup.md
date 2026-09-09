# 站点罗盘数据整理

- 更新时间：2026-09-07（Asia/Shanghai）。
- 目标：清空站点罗盘的演示数据，按用户提供的清单重建分类与描述。
- 状态：已完成；开发服务已实时加载新数据。

## 最终数据

- 开发：3 条。
- 学习：7 条。
- 运维：8 条。
- 魔法：3 条。
- 前端：8 条。
- 游戏：2 条。
- AI：19 条。
- 工具：5 条。
- 合计：55 条；站点名称与链接均无重复。

控制台、主机与托管入口归入“运维”；良心云、开速云与机场推荐归入“魔法”；邮箱、云文档、云笔记、素材与 2FA 归入“工具”；包子漫画作为休闲入口归入“游戏”。显示名称统一了空格与明显拼写（如 Cloudflare、Ant Design、ChatGPT、OpenCode、2FA），链接保留用户清单中的目标与查询参数。

## 修改文件

- `src/data/compass.ts`：替换全部罗盘分组、入口、链接和说明。
- `tests/site/compass.spec.ts`：同步分组数量、筛选、搜索、深链、中文文案和外链断言。
- `public/assets/compass/*.png`：42 个本地缓存的站点 logo。
- `scripts/compass/cache-site-icons.mjs`：可重复运行的 favicon 缓存脚本，限制响应大小并通过 Sharp 转换为安全的本地 PNG。
- `package.json`：新增 `pnpm.cmd compass:icons` 图标刷新命令。
- `src/generated/local-icon-collections.ts`：补齐分类与卡片兜底图标的本地图标集合。

## 验证

- 数据脚本核对：8 个分组，55 个名称 / 55 个链接，名称和链接均唯一。
- 查询参数核对：云同步笔记、Umans、Iconfont、千问链接中的 `&` 参数均完整保留。
- `pnpm.cmd exec biome ci src/data/compass.ts tests/site/compass.spec.ts`：通过。
- `pnpm.cmd exec astro check`：240 个文件，0 errors / 0 warnings / 0 hints。
- `pnpm.cmd exec playwright test tests/site/compass.spec.ts`：7/7 通过。
- `pnpm.cmd exec playwright test tests/site/a11y.spec.ts --grep "站点罗盘"`：浅色与深色模式 2/2 通过。
- `http://localhost:4321/compass/`：HTTP 200；后台 Astro 服务继续运行（后续内容清理时重启，当前监听 PID 为 `17832`）。
- 图标缓存：34 个来自站点 favicon，8 个来自本地 Simple Icons，13 个使用本地 Material Symbols 分类图标；55 张卡片均有图标，运行时不请求第三方图标服务。
- 真实 Chrome 检查：42/42 个本地 PNG 成功加载，13 个 SVG 兜底正常渲染，首字母占位为 0，8 个分类图标全部渲染。

## 范围与授权

- 未测试第三方站点可用性、登录状态或局域网入口连通性；本次只按清单配置目标地址。
- 未执行暂存、Commit、Push、PR 或部署。
