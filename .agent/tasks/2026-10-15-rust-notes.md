# Rust 笔记导入与发布

- 日期：2026-10-15，Asia/Shanghai
- 来源：`/home/helan/labs/learn-rust/notes`，12 篇文章，README 作为导入说明，未作为独立博文
- 目标：`src/content/posts/rust/` 与 `src/content/series/rust.md`
- 内容：保留标题、摘要、标签、正文、示例与学习日期，`date` 映射为 `published`，20 处篇间 Markdown 链接映射为博客 URL
- 系列：`rust`，按来源学习依赖顺序标记 `seriesOrder: 1..12`，分类 Rust，非草稿；来源没有具体时刻，未虚构 `publishedAt`
- 环境：本地 Linux x86_64，执行 Bash；临时使用已有 Node 24.20.0 和 pnpm 9.14.4，不修改全局默认 Node 18
- 内容来源模式：`content:status` 确认 local，无外部内容仓
- 已验证：12 篇日期逐一一致，正文仅变更篇间链接，全部代码围栏内容保持一致；Astro check 279 个文件 0 errors / 0 warnings / 0 hints；pnpm build 成功；生产 HTML、系列 12 篇入口、RSS、Atom、sitemap 均包含文章，站内 Rust 链接目标存在
- 浏览器：12 篇均返回 200，标题、日期、正文和系列块核对通过；已有 a11y 的文章页与系列索引明暗主题 4 项通过；新导入 RefCell / Weak 文章的明暗主题 axe 检查 2 项通过；系列到文章和篇间链接的 Swup 导航通过（等待内容替换后断言）
- 构建提示：空 moments 集合与不存在的 src/icons 目录警告；Pagefind 对 zh-cn 不做词干匹配，均未阻断构建
- 发布授权：用户已明确允许提交并推送 main，继续发布
- 首次推送：22dafc8 已推送 origin/main；远端 CI 已触发；GitHub 未返回托管平台部署记录，线上发布尚未确认
- 后续调整：用户明确要求删除博客笔记全部“示例源文件：……”行并再次推送；已从 12 篇删除 28 行及对应空行，代码块和 frontmatter 保持一致
- 日志：`/tmp/shirone-rust-check.log`、`/tmp/shirone-rust-build.log`、`/tmp/shirone-rust-a11y.log`

- 后续验证：删除后 Astro check 再次通过，279 文件 0 errors / 0 warnings / 0 hints；diff 检查通过；原始笔记目录未修改
- 远端 CI：首次提交 22dafc8 的运行 38756308077 失败，417 项单测中 4 项失败，集中在 tests/content/imported-notes.test.mjs 的固定文章数量、旧文章正文与标签断言；本次按用户要求仅清理源文件说明，不扩展修改这些测试
