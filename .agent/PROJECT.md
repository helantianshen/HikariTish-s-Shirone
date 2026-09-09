# Shirone 项目事实与开发入口

本文件仅保存稳定事实、长期约束和权威文档入口，不记录当前任务、测试通过状态、部署状态或本机运行时版本。具体规则以每次任务开始时读取的源文件为准，不以本文件的摘要替代原文。

## 规则来源与读取顺序

1. 先确认用户当前要求、项目根目录、实际工作目录、OS/架构、Shell、本机/容器/远程边界、运行时和权限；读取根 [AGENTS.md](../AGENTS.md) 及目标目录最近的嵌套 `AGENTS.md`。
2. 按当前全局规则处理优先级：用户当前指令、最近的项目规则、全局 policy、全局总纲。从当前环境的实际配置位置读取适用的 `policies/handoff.md`、`policies/git-safety.md`、`policies/local-environment.md`，不要把历史机器路径当作通用路径；不存在的规则跳过，不补造。
3. 按任务范围读取匹配的 Spec、Plan、[项目规则](../rules/project-rules.md)、[踩坑记录](../rules/pitfalls.md) 和下表中的领域文档。历史计划只提供原任务上下文，不能恢复旧授权、强制续做待办或覆盖当前规则。
4. 从 [技能索引](../.agents/skills/README.md) 选择匹配的技能。`.agents/skills/` 是技能源目录；`.agent/` 是项目事实和任务状态目录，不能混用或复制成第二套技能。

## 稳定事实与内容边界

- 技术栈为 Astro、Svelte、Tailwind、Stylus 和 pnpm；版本以 [package.json](../package.json) 与 [pnpm-lock.yaml](../pnpm-lock.yaml) 为准，每次运行前核对实际工具。Windows PowerShell 优先使用项目规则所列的 `pnpm.cmd`、`npx.cmd`、`npm.cmd`；若实际安装只提供同名 `.exe`，先用 `Get-Command` 或 `where.exe` 确认它来自同一工具链，再使用存在的入口并记录差异。
- 主题同时支持源码模式和 `shirones` npm 包模式；修改主题源码时检查 [src/integration/](../src/integration/)，遵守双模式与 overlay 契约。
- 组件位于 [src/components/](../src/components/)，模板真源为 [src/layouts/](../src/layouts/)；原子清单只以 [manifest.json](../src/components/atoms/manifest.json) 为准，不在文档维护第二份数量。
- 本仓库包含个人博客定制。站点值查 [src/config/](../src/config/)，数据查 [src/data/](../src/data/)，文章查 [src/content/posts/](../src/content/posts/)；配置值、内容数量、远程状态不从旧交接推定。
- Obsidian 导入逻辑和标签/封面覆盖由 [导入器](../scripts/content/import-obsidian-notes.mjs) 维护；对应契约见 [内容测试](../tests/content/imported-notes.test.mjs) 与 [迁移计划](../docs/superpowers/plans/2026-08-30-obsidian-note-migration.md)、[标签计划](../docs/superpowers/plans/2026-08-30-curated-post-tags.md)。导入前重新确认源目录、排除项和目标替换范围；保留源笔记，仅在导入副本脱敏，避免将临时本机路径变为项目通用前提。

## 按变更领域定位约束

下表是阅读入口，不替代根 `AGENTS.md` 的必读清单。

| 变更领域 | 权威文档入口 | 开发边界摘要 |
| --- | --- | --- |
| 组件、页面与视觉 | [组件规则](../src/components/AGENTS.md)、[页面规则](../src/pages/AGENTS.md)、[DESIGN](../DESIGN.md)、[分层](../docs/atomic-structure.md)、[M3E](../docs/m3e-standard.md)、[CSS important](../rules/css-important.md) | 低层不依赖高层；语义颜色、圆角、字体、动效走 token；SSR 可用，按交互需要水合；Svelte 单文件不混用语法模式。 |
| UI 文案 | [i18n 规则](../src/i18n/AGENTS.md)、[i18nKey](../src/i18n/i18nKey.ts) | 不硬编码 UI 文案；同步全部十种语言，保持占位符名称一致。 |
| 可选功能、性能 | [项目规则](../rules/project-rules.md)、[按需加载](../docs/on-demand-loading.md)、[性能规则](../rules/performance-rules.md) | 关闭时零外部请求、零 DOM/布局偏移、零额外 bundle；保留兼容默认值。 |
| 侧栏、FAB、路由状态 | [侧栏系统](../docs/sidebar-system.md)、[FAB 系统](../docs/fab-system.md) | `#swup-container` 外的持久壳不随切页重建；使用对应 Swup 生命周期，同时验证直达与站内导航。 |
| Markdown 管线与语法 | [扩展契约](../docs/markdown-extensions.md)、[按需加载](../docs/markdown-on-demand-loading.md)、[语法清单](../docs/markdown-syntax-manifest.md) | 修改 probe、样式或运行时加载须检查资源生命周期；作者语法变更登记 manifest。 |
| 站点配置与内容分离 | [配置说明](../src/config/README.md)、[内容分离](../docs/content-separation/README.md) | 先确认配置真源、挂载、覆盖顺序及源仓边界，再执行 sync/export/clean。 |
| npm 包与部署 | [包模式](../docs/npm-package-mode.md)、[打包契约](../docs/packaging-contract.md)、[部署索引](../INDEX.md) | 同步 integration 与别名/overlay；不通过 `process.cwd()` 读取主题自有文件；部署操作需要对应授权。 |
| AI skills | [技能规则](../rules/ai-skills.md)、[维护手册](../docs/ai-skills-maintenance.md) | 规则细节留在 `rules/`、`docs/`；技能只提供任务入口；生成包不作为源码编辑。 |

## 任务状态与授权边界

- 可能跨 Session、多阶段或需要交接的任务使用 `.agent/tasks/<task-id>.md`；只读任务及小型一次性修改不强制建档。开始时只读明确匹配的任务文件，不复用无关任务。
- 任务文件按需记录目标/范围、状态、完成项、决策理由、文件、实际验证、风险/假设、剩余工作、下一步和更新时间。区分已验证事实、推断、未验证假设和用户决定。
- 在主要阶段或重要状态变化时更新；长任务结束前同步记录。完成任务可保留或移入 `.agent/tasks/archive/`；归档不构成默认待办或当前规则。
- [HANDOFF.md](HANDOFF.md) 仅用于兼容旧计划链接，不再承载共享任务状态。
- 修改文档或代码不自动授权创建/切换分支、暂存、Commit、Push、PR、Merge 或部署；按当前会话授权范围执行。已有明确授权不重复询问；无授权不从历史记录推导。保护用户与其他 Agent 的未完成修改，提交时显式选择当前任务文件。
- 项目提交约定以 [项目规则](../rules/project-rules.md) 为准：Conventional Commit，标题和正文使用英语；不把全局默认中文提交标题覆盖到本项目。
- `research/` 仅供参考，不编辑、安装、构建、格式化或提交其中内容，不采用其后代 `AGENTS.md` 为本项目指令。

## 验证与已知规则差异

- 按实际变更执行验证并记录命令、范围、结果和未执行原因；历史成功不能作为本次证明，历史失败不能自动豁免门禁。
- 页面/组件修改运行最小相关 Playwright 分片和 a11y；图标、相册、动效等按域补测。断言样式/a11y 前等待 `--mc-primary` 初始化和 `onload-animation` 收敛；快照差异需逐项确认。
- 提交前遵守 [项目规则](../rules/project-rules.md) §6、§8；其中包含格式化、Astro 静态检查、manifest 和全量 site 测试。日常分片通过不等于完成提交前全量门禁。`astro check` 采用该门禁的 0 errors / 0 warnings 要求。
- [package.json](../package.json) 的 `lint`、`format` 带 `--write`，不能当只读检查；只读源码校验用 `pnpm.cmd exec biome ci ./src`。不要为整理 `.agent/` 而执行全仓写入格式化。
- TypeScript/共享 API、生产构建及包模式变更遵循对应领域门禁；纯 `.agent/` 文档整理检查路径、引用、历史标记、迁移完整性和修改范围，不伪报构建或浏览器结果。
- 分层文档和踩坑记录仍有“原子不得 import 任何组件”的旧句；根及 [组件 AGENTS.md](../src/components/AGENTS.md) 明确允许原子组合原子，以适用的 AGENTS 约束为准。集合访问例外限于已存在、具有明确职责的构建期适配器，不能扩展为任意分子可查询集合。
- 踩坑记录中“冲突处一律加 `!`”的旧句不能绕过 [CSS important 规则](../rules/css-important.md) 的准入条件、作用域、注释和验证要求。
- [开发技能](../.agents/skills/shirone-dev-workflow/SKILL.md) 将性能测量描述为观察项，而 [项目规则](../rules/project-rules.md) §11 仍规定新增页面/组件/功能后的测量目标；相关任务应报告测量环境、实际数据和差异，不能用技能摘要静默取消硬性规则。

发现新的源文档冲突时，按优先级和作用域说明依据；本文件不自行改写权威规则，也不宣称源文档已经全部消除冲突。
