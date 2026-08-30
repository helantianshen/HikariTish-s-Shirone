# Curated Post Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragmented or missing imported-note tags with a stable, curated taxonomy of one stack tag and at most two reusable topic tags per article.

**Architecture:** Keep tag ownership in the Obsidian importer so regenerated posts remain deterministic. Map each source category to one canonical stack tag, map every imported article to zero to two curated topic tags, and validate the generated frontmatter rather than editing 56 generated files by hand.

**Tech Stack:** Node.js, YAML frontmatter, Astro content collections, Node test runner, Playwright.

---

### Task 1: Define the generated-tag contract

**Files:**
- Modify: `tests/content/imported-notes.test.mjs`

- [x] **Step 1: Add a failing taxonomy test**

Assert that all 56 posts have one to three unique tags, that the first tag matches the category's canonical stack tag, and that representative articles resolve exactly to:

```js
[
	["Go GMP 调度算法", ["go", "并发", "底层原理"]],
	["MySQL 主从架构与读写分离", ["mysql", "分布式", "主从模式"]],
	["Docker常用命令", ["docker", "运维"]],
]
```

- [x] **Step 2: Verify the test fails against the current imported tags**

Run: `node --test tests/content/imported-notes.test.mjs`

Expected: taxonomy assertion fails because existing posts contain empty arrays and fragmented source tags.

### Task 2: Generate curated tags during import

**Files:**
- Modify: `scripts/content/import-obsidian-notes.mjs`
- Regenerate: `src/content/posts/**/*.md`

- [x] **Step 1: Add canonical category and article topic maps**

Use lowercase stack tags (`go`, `gin`, `gorm`, `mysql`, `redis`, `docker`, `linux`) and reusable Chinese topic tags such as `并发`, `底层原理`, `性能优化`, `分布式`, and `主从模式`. Keep each article at a maximum of three tags total.

- [x] **Step 2: Stop copying source-note tags**

Build frontmatter tags from the canonical category tag plus the article's curated topic tags:

```js
const tags = [
	categoryTags.get(note.category),
	...(articleTopicTags.get(`${note.category}/${note.title}`) ?? []),
];
```

- [x] **Step 3: Regenerate all imported posts**

Run: `node scripts/content/import-obsidian-notes.mjs`

Expected: 56 articles imported and the existing secret-redaction count retained.

- [x] **Step 4: Verify the content contract passes**

Run: `node --test tests/content/imported-notes.test.mjs`

Expected: all tests pass, including exact representative tag sets and the global one-to-three tag limit.

### Task 3: Validate rendered tag navigation

**Files:**
- Modify: `tests/site/imported-notes.spec.ts`
- Modify: `.agent/HANDOFF.md`

- [x] **Step 1: Add browser assertions for representative tags**

Confirm an article renders its canonical tags and that the tags page exposes the consolidated labels `go`, `gin`, `docker`, `分布式`, and `主从模式`.

- [x] **Step 2: Run focused validation**

Run:

```powershell
pnpm.cmd exec biome ci scripts/content/import-obsidian-notes.mjs tests/content/imported-notes.test.mjs tests/site/imported-notes.spec.ts
node --test tests/content/imported-notes.test.mjs
npx.cmd playwright test tests/site/imported-notes.spec.ts
npx.cmd astro check
```

Expected: formatting/static checks pass, browser assertions pass, and Astro reports 0 errors, 0 warnings, and 0 hints.

- [x] **Step 3: Update the shared handoff**

Record the taxonomy rule, modified files, validation results, and that tag changes persist across future Obsidian imports.

No Git or GitHub step is included because the current task does not authorize version-control operations.
