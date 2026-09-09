# Obsidian 导入文章自定义摘要

- 更新时间：2026-09-07（Asia/Shanghai）。
- 目标：允许每篇 Obsidian 源笔记通过 frontmatter 自定义首页卡片摘要，同时保留缺省回退和凭据脱敏。
- 状态：已完成；当前 56 篇文章均已应用逐篇整理的摘要。

## 最终行为

- 源笔记 frontmatter 中非空的 `description` 优先写入导入文章。
- 未提供或只含空白时，继续生成 `关于「<标题>」的技术笔记。`，保持现有文章兼容。
- 自定义摘要与正文共用同一套凭据形态脱敏规则；摘要中的脱敏数量计入导入结果统计。
- 当前 56 篇源笔记没有 `description`；项目导入器因此为每篇维护一条根据正文结构整理的摘要。后续若在对应 Obsidian 源笔记顶部加入 YAML frontmatter，自定义值会覆盖项目内回退摘要，不应只改生成后的 `src/content/posts/` 副本。

示例：

```yaml
---
description: 记录 GoLand 内存、索引与运行参数的调优方法。
---
```

## 修改文件

- `scripts/content/import-obsidian-notes.mjs`
- `scripts/content/import-utils.mjs`
- `tests/content/imported-notes.test.mjs`
- `src/content/posts/**/*.md`：56 篇文章仅更新 frontmatter `description`。
- `.agent/PROJECT.md`：根据本次实际环境核验，补充 `npx.exe` 兼容说明。

## TDD 与验证

- RED：新增两项摘要测试后运行名称分片，2 项均因缺少解析器按预期失败。
- GREEN：实现解析器并接入导入器后，同一分片 2/2 通过。
- `node scripts/content/import-obsidian-notes.mjs`：成功导入 56 篇，正文共脱敏 16 处；生成文章无内容差异。
- `node --test tests/content/imported-notes.test.mjs`：首次功能验证 8/8 通过；加入 56 篇摘要完整性断言后 9/9 通过。
- `pnpm.cmd exec biome ci scripts/content/import-obsidian-notes.mjs scripts/content/import-utils.mjs tests/content/imported-notes.test.mjs`：通过。
- `pnpm.cmd check:manifest`：通过。
- `npx.exe astro check`：240 个文件，0 errors / 0 warnings / 0 hints。当前 xlings 工具链只有 `npx.exe`，没有 `npx.cmd`；已通过 `Get-Command` 与 `where.exe` 核验。
- `pnpm.cmd exec playwright test "tests/site/imported-notes.spec.ts"`：3/3 通过。此前首次使用 `npx.exe` 加反斜杠路径时 Playwright 未匹配到文件，正斜杠路径与项目内 pnpm 执行均正常。
- 开发服务器原进程没有接受批量文章重建的热更新，磁盘已是新摘要而首页仍返回旧摘要；仅重启该 Astro 服务后恢复。当前首页 HTTP 200，包含新的 GoLand 摘要且不再包含其旧模板摘要。

## 范围与授权

- 未修改 `E:/Obsidian-NoteBook/Note` 中的源笔记，也未替用户撰写或猜测具体摘要。
- 未执行暂存、Commit、Push、PR 或部署。
