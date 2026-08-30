import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import YAML from "yaml";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const postsRoot = path.join(projectRoot, "src/content/posts");

const expectedCategories = new Map([
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

const expectedStackTags = new Map([
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

const potentialSecretPatterns = [
	/sk-[A-Za-z0-9_-]{20,}/g,
	/ghp_[A-Za-z0-9]{20,}/g,
	/github_pat_[A-Za-z0-9_]{20,}/g,
	/AKIA[A-Z0-9]{16}/g,
	/LTAI[A-Za-z0-9]{12,}/g,
	/AIza[0-9A-Za-z_-]{20,}/g,
	/xox[baprs]-[A-Za-z0-9-]{10,}/g,
	/(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/gi,
];

async function collectMarkdownFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory())
			files.push(...(await collectMarkdownFiles(fullPath)));
		if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(fullPath);
	}
	return files;
}

function parsePost(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	assert.ok(match, "每篇导入文章都必须包含 frontmatter");
	return {
		data: YAML.parse(match[1]),
		body: source.slice(match[0].length),
	};
}

describe("Obsidian 笔记导入结果", () => {
	it("只包含排除资产平台管理和 Eino 后的 56 篇文章", async () => {
		const files = await collectMarkdownFiles(postsRoot);
		assert.equal(files.length, 56);

		const categoryCounts = new Map();
		for (const file of files) {
			const { data } = parsePost(await readFile(file, "utf8"));
			categoryCounts.set(
				data.category,
				(categoryCounts.get(data.category) ?? 0) + 1,
			);
			assert.doesNotMatch(file, /资产平台管理|[\\/]eino[\\/]/i);
			assert.notEqual(data.category, "资产平台管理");
			assert.notEqual(data.category, "Eino");
		}

		assert.deepEqual(categoryCounts, expectedCategories);
	});

	it("公开 AI 工作站文章不带加密字段且源码凭据已脱敏", async () => {
		const files = await collectMarkdownFiles(postsRoot);
		let redactionCount = 0;
		for (const file of files) {
			const source = await readFile(file, "utf8");
			const { data } = parsePost(source);
			assert.doesNotMatch(source, /!??\[\[[^\]]+\]\]/);
			for (const pattern of potentialSecretPatterns) {
				assert.doesNotMatch(source, pattern);
			}
			redactionCount += source.match(/REDACTED_SECRET/g)?.length ?? 0;

			if (data.category === "配置AI工作站") {
				assert.notEqual(data.encrypted, true);
				assert.equal(data.password, undefined);
				assert.equal(data.passwordEnv, undefined);
			}
		}

		assert.ok(redactionCount > 0, "至少应脱敏一处源笔记中的凭据");
	});

	it("使用精简且统一的技术栈与主题标签", async () => {
		const files = await collectMarkdownFiles(postsRoot);
		const tagsByTitle = new Map();
		const allTags = new Set();

		for (const file of files) {
			const { data } = parsePost(await readFile(file, "utf8"));
			assert.ok(Array.isArray(data.tags));
			assert.ok(
				data.tags.length >= 1 && data.tags.length <= 3,
				`${data.title} 应只保留 1 至 3 个标签`,
			);
			assert.equal(new Set(data.tags).size, data.tags.length);
			assert.equal(data.tags[0], expectedStackTags.get(data.category));
			for (const tag of data.tags) allTags.add(tag);
			tagsByTitle.set(data.title, data.tags);
		}

		assert.ok(allTags.size <= 30, `标签总数应保持精简，当前为 ${allTags.size}`);
		assert.deepEqual(tagsByTitle.get("Go GMP 调度算法"), [
			"go",
			"并发",
			"底层原理",
		]);
		assert.deepEqual(tagsByTitle.get("MySQL 主从架构与读写分离"), [
			"mysql",
			"分布式",
			"主从模式",
		]);
		assert.deepEqual(tagsByTitle.get("Docker常用命令"), ["docker", "运维"]);
	});

	it("Docker常用命令使用项目内的本地封面", async () => {
		const postPath = path.join(postsRoot, "docker", "docker常用命令.md");
		const { data } = parsePost(await readFile(postPath, "utf8"));
		assert.equal(
			data.image,
			"../../../assets/images/posts/docker-commands-cover.jpg",
		);
		await access(
			path.join(
				projectRoot,
				"src/assets/images/posts/docker-commands-cover.jpg",
			),
		);
	});

	it("Go GMP 调度算法使用项目内的本地封面", async () => {
		const postPath = path.join(postsRoot, "go", "go-gmp-调度算法.md");
		const { data } = parsePost(await readFile(postPath, "utf8"));
		assert.equal(data.image, "../../../assets/images/posts/go-gmp-cover.png");
		await access(
			path.join(projectRoot, "src/assets/images/posts/go-gmp-cover.png"),
		);
	});

	it("Go Context 底层原理使用项目内的本地封面", async () => {
		const postPath = path.join(postsRoot, "go", "go-context-底层原理.md");
		const { data } = parsePost(await readFile(postPath, "utf8"));
		assert.equal(
			data.image,
			"../../../assets/images/posts/go-context-cover.png",
		);
		await access(
			path.join(projectRoot, "src/assets/images/posts/go-context-cover.png"),
		);
	});
});
