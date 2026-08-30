import assert from "node:assert/strict";
import {
	cp,
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const postsRoot = path.resolve(projectRoot, "src/content/posts");
const expectedPostsRoot = path.join(projectRoot, "src", "content", "posts");
const notebookRoot = path.resolve(
	process.env.OBSIDIAN_NOTEBOOK_ROOT ?? "E:/Obsidian-NoteBook/Note",
);

const excludedCategories = new Set(["资产平台管理", "Eino"]);
const categoryDirectories = new Map([
	["Docker", "docker"],
	["Gin 框架", "gin"],
	["Go", "go"],
	["Go语言性能陷阱", "go-performance"],
	["Gorm", "gorm"],
	["Linux", "linux"],
	["Mysql", "mysql"],
	["Redis", "redis"],
	["配置AI工作站", "ai-workstation"],
]);
const expectedCategoryCounts = new Map([
	["Docker", 2],
	["Gin 框架", 11],
	["Go", 8],
	["Go语言性能陷阱", 3],
	["Gorm", 13],
	["Linux", 4],
	["Mysql", 9],
	["Redis", 3],
	["配置AI工作站", 3],
]);
const categoryTags = new Map([
	["Docker", "docker"],
	["Gin 框架", "gin"],
	["Go", "go"],
	["Go语言性能陷阱", "go"],
	["Gorm", "gorm"],
	["Linux", "linux"],
	["Mysql", "mysql"],
	["Redis", "redis"],
	["配置AI工作站", "AI 工具"],
]);
const articleTopicTags = new Map([
	["Docker/Docker常用命令", ["运维"]],
	["Docker/ElasticSearch部署", ["elasticsearch", "部署"]],
	["Gin 框架/中间件", ["Web 开发"]],
	["Gin 框架/会话管理", ["Web 开发"]],
	["Gin 框架/快速入门", ["Web 开发", "入门"]],
	["Gin 框架/性能优化", ["Web 开发", "性能优化"]],
	["Gin 框架/数据库引入", ["Web 开发", "数据库"]],
	["Gin 框架/数据验证", ["Web 开发", "工程实践"]],
	["Gin 框架/文件处理", ["Web 开发"]],
	["Gin 框架/日志系统", ["Web 开发", "日志"]],
	["Gin 框架/请求和响应处理", ["Web 开发"]],
	["Gin 框架/路由系统", ["Web 开发"]],
	["Gin 框架/项目最佳实践", ["Web 开发", "工程实践"]],
	["Go/Go Channel 底层原理", ["并发", "底层原理"]],
	["Go/Go Context 底层原理", ["并发", "底层原理"]],
	["Go/Go GC 三色标记法与混合写屏障", ["内存管理", "底层原理"]],
	["Go/Go GC 调优实践", ["内存管理", "性能优化"]],
	["Go/Go GMP 调度算法", ["并发", "底层原理"]],
	["Go/Go Map 底层原理与扩容机制", ["数据结构", "底层原理"]],
	["Go/Go Slice 底层原理与扩容机制", ["数据结构", "底层原理"]],
	["Go/Go sync.Pool 底层原理", ["并发", "内存管理"]],
	[
		"Go语言性能陷阱/for...range 遍历切片/数组时的值拷贝陷阱",
		["性能优化", "数据结构"],
	],
	["Go语言性能陷阱/time.After 内存泄漏陷阱", ["性能优化", "内存管理"]],
	[
		"Go语言性能陷阱/滥用 fmt.Sprintf 进行简单字符串拼接的性能陷阱",
		["性能优化"],
	],
	["Gorm/CRUD查询", ["数据库"]],
	["Gorm/Gin项目集成", ["gin", "数据库"]],
	["Gorm/GORM配置项", ["数据库", "工程实践"]],
	["Gorm/事务与并发控制", ["数据库", "事务"]],
	["Gorm/关联关系", ["数据库"]],
	["Gorm/原生SQL与Scopes", ["数据库"]],
	["Gorm/快速开始", ["数据库", "入门"]],
	["Gorm/数据源配置", ["数据库", "工程实践"]],
	["Gorm/条件查询与分页", ["数据库"]],
	["Gorm/模型定义与标签", ["数据库", "工程实践"]],
	["Gorm/迁移与初始化", ["数据库", "工程实践"]],
	["Gorm/连接池与性能优化", ["数据库", "性能优化"]],
	["Gorm/错误处理与调试", ["数据库", "问题排查"]],
	["Linux/Linux mmap 与 Go 内存映射优化", ["go", "内存管理"]],
	["Linux/Linux sendfile 与 Go 零拷贝优化", ["go", "零拷贝"]],
	["Linux/Linux 常用命令", ["运维"]],
	[
		"Linux/WSL2 JetBrains Gateway 终端日志渲染消失排查与解决",
		["开发环境", "问题排查"],
	],
	["Mysql/MySQL Buffer Pool 与 Change Buffer", ["内存管理", "底层原理"]],
	["Mysql/MySQL Using filesort 调优", ["SQL 优化", "性能优化"]],
	["Mysql/MySQL 主从架构与读写分离", ["分布式", "主从模式"]],
	["Mysql/MySQL 事务、MVCC 与锁", ["事务", "底层原理"]],
	["Mysql/MySQL 分库分表", ["分布式"]],
	["Mysql/MySQL 复杂 SQL 调优", ["SQL 优化", "性能优化"]],
	["Mysql/MySQL 日志与调优", ["日志", "底层原理"]],
	["Mysql/MySQL 索引底层与优化", ["SQL 优化", "性能优化"]],
	["Mysql/MySQL 表结构设计规范", ["数据库", "工程实践"]],
	["Redis/数据结构：Hash 哈希底层原理", ["数据结构", "底层原理"]],
	["Redis/数据结构：List 列表底层原理", ["数据结构", "底层原理"]],
	["Redis/数据结构：String 与 SDS 底层原理", ["数据结构", "底层原理"]],
	["配置AI工作站/AI安装", ["开发环境"]],
	["配置AI工作站/GoLand 调优", ["开发环境", "性能优化"]],
	["配置AI工作站/pi-pattern-retry-配置指南", ["工程实践"]],
]);
const postOverrides = new Map([
	[
		"Docker/Docker常用命令",
		{
			image: "../../../assets/images/posts/docker-commands-cover.jpg",
		},
	],
	[
		"Go/Go GMP 调度算法",
		{
			image: "../../../assets/images/posts/go-gmp-cover.png",
		},
	],
	[
		"Go/Go Context 底层原理",
		{
			image: "../../../assets/images/posts/go-context-cover.png",
		},
	],
]);

const providerSecretPatterns = [
	/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
	/ghp_[A-Za-z0-9]{20,}/g,
	/github_pat_[A-Za-z0-9_]{20,}/g,
	/AKIA[A-Z0-9]{16}/g,
	/LTAI[A-Za-z0-9]{12,}/g,
	/AIza[0-9A-Za-z_-]{20,}/g,
	/xox[baprs]-[A-Za-z0-9-]{10,}/g,
];
const assignedSecretPattern =
	/((?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*)(["'])([^"']{12,})\2/gi;

function normalizeDate(value, fallbackDate) {
	const text =
		value instanceof Date ? value.toISOString() : String(value ?? "");
	const match = text.match(/^\d{4}-\d{2}-\d{2}/);
	if (match) return match[0];

	const year = fallbackDate.getFullYear();
	const month = String(fallbackDate.getMonth() + 1).padStart(2, "0");
	const day = String(fallbackDate.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function slugify(value) {
	const slug = value
		.normalize("NFKC")
		.toLocaleLowerCase("zh-CN")
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	assert.ok(slug, `无法为文章生成 slug: ${value}`);
	return slug;
}

function splitFrontmatter(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { data: {}, body: source };
	return {
		data: YAML.parse(match[1]) ?? {},
		body: source.slice(match[0].length),
	};
}

function sanitizeSecrets(source) {
	let content = source;
	let redactionCount = 0;

	content = content.replace(assignedSecretPattern, (_match, prefix, quote) => {
		redactionCount += 1;
		return `${prefix}${quote}REDACTED_SECRET${quote}`;
	});

	for (const pattern of providerSecretPatterns) {
		content = content.replace(pattern, () => {
			redactionCount += 1;
			return "REDACTED_SECRET";
		});
	}

	return { content, redactionCount };
}

async function collectSourceNotes() {
	const categoryEntries = await readdir(notebookRoot, { withFileTypes: true });
	const notes = [];

	for (const categoryEntry of categoryEntries) {
		if (
			!categoryEntry.isDirectory() ||
			excludedCategories.has(categoryEntry.name) ||
			!categoryDirectories.has(categoryEntry.name)
		) {
			continue;
		}

		const categoryPath = path.join(notebookRoot, categoryEntry.name);
		const entries = await readdir(categoryPath, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") {
				continue;
			}

			const sourcePath = path.join(categoryPath, entry.name);
			const source = await readFile(sourcePath, "utf8");
			const fileStats = await stat(sourcePath);
			const { data, body } = splitFrontmatter(source);
			const fallbackTitle = path.basename(entry.name, path.extname(entry.name));
			const title = String(data.title ?? fallbackTitle).trim() || fallbackTitle;
			notes.push({
				category: categoryEntry.name,
				data,
				body,
				modifiedAt: fileStats.mtime,
				sourcePath,
				title,
				slug: slugify(title),
			});
		}
	}

	return notes.sort((left, right) =>
		left.sourcePath.localeCompare(right.sourcePath, "zh-CN"),
	);
}

function buildLinkRegistry(notes) {
	const registry = new Map();
	for (const note of notes) {
		const categoryDirectory = categoryDirectories.get(note.category);
		const route = `/posts/${categoryDirectory}/${note.slug}/`;
		const relativeWithoutExtension = path
			.relative(notebookRoot, note.sourcePath)
			.replace(/\\/g, "/")
			.replace(/\.md$/i, "");
		const basename = path.basename(
			note.sourcePath,
			path.extname(note.sourcePath),
		);
		registry.set(relativeWithoutExtension, route);
		registry.set(basename, route);
		registry.set(`${note.category}/${basename}`, route);
	}
	return registry;
}

function convertObsidianLinks(source, registry) {
	return source.replace(/!?\[\[([^\]]+)\]\]/g, (_match, rawTarget) => {
		const [targetWithHeading, alias] = rawTarget.split("|", 2);
		const [target, heading] = targetWithHeading.split("#", 2);
		const normalizedTarget = target.replace(/\\/g, "/").replace(/\.md$/i, "");
		const label =
			alias?.trim() || heading?.trim() || path.basename(normalizedTarget);
		const route =
			registry.get(normalizedTarget) ??
			registry.get(path.basename(normalizedTarget));
		if (!route) return label;
		return `[${label}](${route}${heading ? `#${slugify(heading)}` : ""})`;
	});
}

function normalizeFenceLanguages(source) {
	return source.replace(
		/^(?<fence>`{3,}|~{3,})(?<language>[A-Za-z][A-Za-z0-9_+-]*)(?<metadata>.*)$/gm,
		(_match, fence, language, metadata) =>
			`${fence}${language.toLowerCase()}${metadata}`,
	);
}

function buildPost(note, registry) {
	const override = postOverrides.get(`${note.category}/${note.title}`) ?? {};
	const articleKey = `${note.category}/${note.title}`;
	const stackTag = categoryTags.get(note.category);
	assert.ok(stackTag, `缺少分类标签映射: ${note.category}`);
	const tags = [stackTag, ...(articleTopicTags.get(articleKey) ?? [])];
	const frontmatter = {
		title: note.title,
		published: normalizeDate(note.data.created, note.modifiedAt),
		description: `关于「${note.title}」的技术笔记。`,
		tags,
		category: note.category,
		pinned: false,
		draft: false,
		comment: true,
		lang: "zh_CN",
		...override,
	};

	let body = note.body.replace(/^\uFEFF/, "").trim();
	const duplicateHeading = new RegExp(
		`^#\\s+${note.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\r?\\n)+`,
	);
	body = body.replace(duplicateHeading, "");
	body = convertObsidianLinks(body, registry);
	body = normalizeFenceLanguages(body);
	const sanitized = sanitizeSecrets(body);

	return {
		content: `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n${sanitized.content.trim()}\n`,
		redactionCount: sanitized.redactionCount,
	};
}

function assertInventory(notes) {
	assert.equal(notes.length, 56, "导入清单必须恰好包含 56 篇笔记");
	const actualCounts = new Map();
	for (const note of notes) {
		actualCounts.set(note.category, (actualCounts.get(note.category) ?? 0) + 1);
		assert.ok(!excludedCategories.has(note.category));
	}
	assert.deepEqual(actualCounts, expectedCategoryCounts);

	const destinationKeys = notes.map((note) => `${note.category}/${note.slug}`);
	assert.equal(
		new Set(destinationKeys).size,
		destinationKeys.length,
		"文章 slug 冲突",
	);
}

async function main() {
	assert.equal(
		postsRoot,
		expectedPostsRoot,
		"拒绝在预期 src/content/posts 之外执行文章替换",
	);
	assert.ok(postsRoot.startsWith(`${projectRoot}${path.sep}`));

	const notes = await collectSourceNotes();
	assertInventory(notes);
	const linkRegistry = buildLinkRegistry(notes);
	const temporaryRoot = path.join(
		projectRoot,
		"src/content",
		`.posts-import-${process.pid}`,
	);
	await rm(temporaryRoot, { recursive: true, force: true });
	await mkdir(temporaryRoot, { recursive: true });

	let redactionCount = 0;
	try {
		for (const note of notes) {
			const destinationDirectory = path.join(
				temporaryRoot,
				categoryDirectories.get(note.category),
			);
			await mkdir(destinationDirectory, { recursive: true });
			const post = buildPost(note, linkRegistry);
			redactionCount += post.redactionCount;
			await writeFile(
				path.join(destinationDirectory, `${note.slug}.md`),
				post.content,
				"utf8",
			);
		}

		assert.ok(redactionCount > 0, "应至少脱敏一处导入内容");
		await rm(postsRoot, { recursive: true, force: true });
		await mkdir(postsRoot, { recursive: true });
		await cp(temporaryRoot, postsRoot, { recursive: true });
		await rm(temporaryRoot, { recursive: true, force: true });
	} catch (error) {
		await rm(temporaryRoot, { recursive: true, force: true });
		throw error;
	}

	console.log(`已导入 ${notes.length} 篇文章，脱敏 ${redactionCount} 处凭据。`);
}

await main();
