# Obsidian Notes Migration Implementation Plan

> **For agentic workers:** Execute this plan inline in the current task. Do not use Git, create commits, push, or dispatch subagents unless the user separately authorizes those actions.

**Goal:** Replace all Shirone demo posts with the 56 Markdown notes under `E:\Obsidian-NoteBook\Note`, excluding both `资产平台管理` and `Eino`, while redacting credential-shaped values only in the imported project copies.

**Architecture:** Treat each included first-level Obsidian directory as the Shirone post category and migrate every Markdown file as one public post under `src/content/posts/`. Preserve prose and standard Markdown, normalize Obsidian metadata and links, and leave the original notebook untouched. AI-workstation notes remain public and use no Shirone encryption fields.

**Tech Stack:** Astro 7 content collections, Markdown, YAML, Node.js, Playwright, pnpm.

---

### Task 1: Lock the inventory and safety boundary

**Files:**

- Source: `E:\Obsidian-NoteBook\Note\**\*.md`
- Exclude: `E:\Obsidian-NoteBook\Note\资产平台管理\**`
- Exclude: `E:\Obsidian-NoteBook\Note\Eino\**`
- Test: `tests/content/imported-notes.test.mjs`

- [x] Assert exactly 56 posts with category counts: `Docker=2`, `Gin 框架=11`, `Go=8`, `Go语言性能陷阱=3`, `Gorm=13`, `Linux=4`, `Mysql=9`, `Redis=3`, `配置AI工作站=3`.
- [x] Assert that no imported path or taxonomy contains `资产平台管理` or `Eino`.
- [x] Assert that imported AI-workstation posts contain no encryption or password fields.
- [x] Scan only imported copies for provider key shapes and quoted API-key assignments; never print matched values.

### Task 2: Build a reproducible importer

**Files:**

- Create: `scripts/content/import-obsidian-notes.mjs`

- [x] Validate that the destructive target resolves exactly to `E:\front_end\Shirone\src\content\posts` and remains below the project root.
- [x] Generate all converted articles in a temporary directory and validate the 56-post inventory before replacing `src/content/posts`.
- [x] Use the source `title` frontmatter when present; otherwise use the filename without `.md`.
- [x] Use source `created` as `published` when valid; otherwise use the source file's last-modified calendar date.
- [x] Preserve source tags, use the source folder as category, and set `draft: false`, `comment: true`, and `lang: zh_CN`.
- [x] Generate descriptions as `关于「<标题>」的技术笔记。` so summaries never copy credential-bearing prose.
- [x] Remove source-only `aliases`, normalize Obsidian links, and leave the notebook source unchanged.
- [x] Replace credential-shaped values in imported project copies with `REDACTED_SECRET`.

### Task 3: Replace the demo posts

**Files:**

- Delete: previous demo files and post-owned assets under `src/content/posts/`
- Create: 56 generated Markdown posts below `src/content/posts/`
- Preserve: `src/content/moments/`, `src/content/spec/`, and `src/content/snippets/`

- [x] Remove the 21 previous demo Markdown posts and their co-located demo assets.
- [x] Import 56 public posts into nine destination directories.
- [x] Redact 16 credential-shaped values in the imported `AI安装` article.
- [x] Verify that no Obsidian wiki-link syntax or credential-shaped value remains in imported source.

### Task 4: Update content-dependent tests

**Files:**

- Modify: `tests/site/feed.spec.ts`
- Modify: `tests/site/llms.spec.ts`
- Test: `tests/content/imported-notes.test.mjs`

- [x] Add deterministic source-level assertions for count, categories, exclusions, public AI posts, link conversion, and redaction.
- [x] Replace demo-title assertions in feeds and llms endpoints with stable imported-post assertions.
- [x] Verify one public imported post and the public AI-workstation post through Playwright.

### Task 5: Validate source, build output, and local preview

**Files:**

- Modify: `.agent/HANDOFF.md`

- [x] Run `node --test tests/content/imported-notes.test.mjs`; result: 2/2 passing.
- [x] Run `pnpm.cmd exec biome ci` on the importer and changed test files; result: passing.
- [x] Run `npx.cmd astro check`; result: 0 errors, 0 warnings, and 0 hints.
- [x] Run `pnpm.cmd check:manifest`; result: success after moving deleted demo-post documentation pointers to the authoring skill.
- [x] Run focused imported-content, feed, and llms Playwright tests; result: 8/8 passing.
- [x] Run `pnpm.cmd build` and scan `dist`; result: build success, zero potential credential matches, 64 rendered redaction markers.
- [x] Open the local homepage, one public technical post, and the public AI-workstation post; all returned HTTP 200 and the AI post had no password gate.
- [x] Update `.agent/HANDOFF.md` with exact counts, validation results, and the recoverability note for removed demo posts.

## Self-review

- The plan covers the adjusted exclusion set, all 56 import candidates, category mapping, public AI-workstation content, imported-copy-only credential redaction, and local validation.
- No password, encryption field, Git operation, `.obsidian` metadata, excluded document, moment, About content, or unreferenced image is included.
