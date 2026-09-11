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
import {
	resolvePostDescriptionResult,
	sanitizeSecrets,
} from "./import-utils.mjs";

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
	["Go", 9],
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
		"Go/从 Channel 到 Future：用 Go 实现 Async-Await 模型",
		["并发", "工程实践"],
	],
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
const curatedDescriptions = new Map([
	[
		"配置AI工作站/AI安装",
		"汇总 Pi Agent 与 Oh My Pi 在 Windows、Linux 上的安装、配置文件和扩展管理流程。",
	],
	[
		"配置AI工作站/GoLand 调优",
		"整理 GoLand 的 JVM、代码缓存、GC 与 Go 工具进程参数，改善大型项目中的内存占用和响应速度。",
	],
	[
		"配置AI工作站/pi-pattern-retry-配置指南",
		"说明 pi-pattern-retry 的安装、事件匹配与重试计划配置，用于在服务异常后自动继续会话。",
	],
	[
		"Docker/Docker常用命令",
		"以 RabbitMQ、Redis 和 MySQL 为例，拆解 docker run、docker exec 及容器重启等常用参数。",
	],
	[
		"Docker/ElasticSearch部署",
		"记录 Elasticsearch 8.17 与 IK 分词器的分步容器部署方案，涵盖国内镜像、插件安装和启动验证。",
	],
	[
		"Gin 框架/会话管理",
		"梳理 Gin 中 Cookie 与 Session 的读写、存储和生命周期管理方式，并给出基础实现示例。",
	],
	[
		"Gin 框架/快速入门",
		"从创建首个 Gin 服务开始，介绍默认中间件、路由注册以及监听地址和端口的配置方法。",
	],
	[
		"Gin 框架/路由系统",
		"覆盖 Gin 的基础路由、路由分组、路径参数、查询参数、表单参数及其他常用注册方式。",
	],
	[
		"Gin 框架/请求和响应处理",
		"讲解 Gin 对 JSON、XML、查询、表单和 URI 参数的绑定，以及多种响应格式的返回方式。",
	],
	[
		"Gin 框架/日志系统",
		"介绍 Gin 日志格式定制、文件输出和 Zap 集成，帮助建立可检索的应用日志链路。",
	],
	[
		"Gin 框架/数据库引入",
		"整理 Gin 项目接入 MySQL、SQL Server 与 PostgreSQL 的 GORM 初始化方式和 DSN 参数。",
	],
	[
		"Gin 框架/数据验证",
		"说明 Gin 参数绑定中的常用验证标签、自定义验证器和错误消息处理方法。",
	],
	[
		"Gin 框架/文件处理",
		"覆盖单文件与多文件上传、类型和大小校验、内容读取，以及本地文件下载与强制下载。",
	],
	[
		"Gin 框架/项目最佳实践",
		"给出 Gin 服务的目录分层建议，并说明密码加密等常见业务能力应放置的位置。",
	],
	[
		"Gin 框架/性能优化",
		"从数据库连接池、Gzip、缓存和路由设计四个方向整理 Gin 服务的常用性能优化手段。",
	],
	[
		"Gin 框架/中间件",
		"讲解全局、路由和分组中间件，并实现 CORS、限流、JWT 认证与统一错误处理。",
	],
	[
		"Go语言性能陷阱/滥用 fmt.Sprintf 进行简单字符串拼接的性能陷阱",
		"分析 fmt.Sprintf 在简单拼接中的接口装箱、格式解析和堆逃逸开销，并比较更轻量的替代方案。",
	],
	[
		"Go语言性能陷阱/for...range 遍历切片/数组时的值拷贝陷阱",
		"解释 for range 的值拷贝语义，以及修改副本、获取循环变量地址和遍历大结构体时的常见问题。",
	],
	[
		"Go语言性能陷阱/time.After 内存泄漏陷阱",
		"追踪高频 select 循环中 time.After 的定时器生命周期、内存压力与不同 Go 版本下的修复方式。",
	],
	[
		"Go/Go Channel 底层原理",
		"从 CSP 模型出发，解析无缓冲、有缓冲和 nil Channel 的结构、阻塞行为与调度协作机制。",
	],
	[
		"Go/Go Context 底层原理",
		"解析 Context 的树形派生结构、取消传播、超时控制和值查找机制，并说明工程中的使用边界。",
	],
	[
		"Go/Go GC 调优实践",
		"围绕 GOGC、GOMEMLIMIT、内存分配和运行时指标，整理 Go 服务的 GC 观测与调优方法。",
	],
	[
		"Go/Go GC 三色标记法与混合写屏障",
		"拆解三色标记流程、并发标记的不变式和混合写屏障，说明 Go GC 如何避免漏标存活对象。",
	],
	[
		"Go/Go GMP 调度算法",
		"解释 Goroutine、线程与逻辑处理器的协作关系，以及本地队列、工作窃取和抢占调度机制。",
	],
	[
		"Go/Go Map 底层原理与扩容机制",
		"梳理 Go Map 的桶结构、哈希定位、读写操作和渐进式扩容过程，并说明并发使用限制。",
	],
	[
		"Go/Go Slice 底层原理与扩容机制",
		"解析 Slice 的指针、长度和容量结构，比较初始化方式、共享底层数组及 append 扩容行为。",
	],
	[
		"Go/Go sync.Pool 底层原理",
		"介绍 sync.Pool 的 Per-P 本地池、private/shared 分级存储、工作窃取与 GC 清理机制。",
	],
	[
		"Go/从 Channel 到 Future：用 Go 实现 Async-Await 模型",
		"用泛型、Channel 与 goroutine 封装 Future/Await 模型，解释异步任务启动、结果等待、错误处理和并发执行边界。",
	],
	[
		"Gorm/错误处理与调试",
		"比较 GORM Traditional 与 Generics API 的错误处理，并介绍错误翻译、日志、DryRun 和执行计划排查。",
	],
	[
		"Gorm/关联关系",
		"整理 GORM 一对一、一对多和多对多关系的模型定义、预加载、关联操作与删除策略。",
	],
	[
		"Gorm/快速开始",
		"提供从 SQLite 入门到切换实际数据库的 GORM 学习路线，涵盖安装、连接、迁移和首个查询。",
	],
	[
		"Gorm/连接池与性能优化",
		"说明 GORM 底层连接池配置与监控，并整理字段裁剪、批量操作、N+1、事务和索引优化。",
	],
	[
		"Gorm/模型定义与标签",
		"介绍 GORM 基础模型、字段标签、默认值、时间字段、软删除及表名和列名约定。",
	],
	[
		"Gorm/迁移与初始化",
		"讲解 AutoMigrate、Migrator、种子数据和应用启动顺序，并说明版本化迁移与约束管理。",
	],
	[
		"Gorm/事务与并发控制",
		"覆盖闭包与手动事务、超时上下文、保存点、行锁和乐观并发控制等数据库一致性手段。",
	],
	[
		"Gorm/数据源配置",
		"梳理 GORM、数据库驱动与 database/sql 的连接关系，并给出多种数据库和环境变量配置方法。",
	],
	[
		"Gorm/条件查询与分页",
		"总结 Where、Select、排序分组、分页和 Scopes 的组合方式，强调参数绑定与查询复用边界。",
	],
	[
		"Gorm/原生SQL与Scopes",
		"介绍 Raw、Exec、命名参数和 SQL 表达式，并用 Scopes 封装可复用查询条件和 DryRun 检查。",
	],
	[
		"Gorm/CRUD查询",
		"覆盖 GORM 创建、读取、更新和删除的两套 API，补充批量操作、安全边界与查询对象复用问题。",
	],
	[
		"Gorm/Gin项目集成",
		"展示 GORM 与 Gin 的分层集成方式，包括数据库注入、Service 事务、请求上下文和测试策略。",
	],
	[
		"Gorm/GORM配置项",
		"梳理 gorm.Config、命名策略、日志和 Session 级选项，并说明 Debug、DryRun 与 ToSQL 的使用场景。",
	],
	[
		"Linux/Linux 常用命令",
		"按目录、文件、文本、进程、网络和权限等场景整理 Linux 常用命令、参数与示例。",
	],
	[
		"Linux/Linux mmap 与 Go 内存映射优化",
		"比较传统 read 与 mmap 的数据路径，解释缺页加载和页面淘汰，并展示 Go 中的内存映射实践。",
	],
	[
		"Linux/Linux sendfile 与 Go 零拷贝优化",
		"分析传统文件发送与 sendfile 的拷贝路径，并说明 Go 的 io.Copy 如何触发零拷贝优化。",
	],
	[
		"Linux/WSL2 JetBrains Gateway 终端日志渲染消失排查与解决",
		"记录 WSL2 直连 JetBrains Gateway 时运行日志消失的诊断过程、根因定位与配置修复。",
	],
	[
		"Mysql/MySQL 表结构设计规范",
		"从 NULL 语义、时间类型、字段长度、索引和数据一致性出发，总结 MySQL 表结构设计取舍。",
	],
	[
		"Mysql/MySQL 分库分表",
		"比较垂直与水平拆分策略，说明分片键、全局 ID、跨库查询和数据迁移带来的工程问题。",
	],
	[
		"Mysql/MySQL 复杂 SQL 调优",
		"针对深度分页、JOIN 和复杂查询分析执行代价，并给出延迟关联、游标分页等优化方案。",
	],
	[
		"Mysql/MySQL 日志与调优",
		"串联 Undo、Redo、Binlog 和慢查询日志的作用，说明事务恢复、复制与性能排查的关键路径。",
	],
	[
		"Mysql/MySQL 事务、MVCC 与锁",
		"从 ACID 和隔离级别展开，解析 Undo/Redo、Read View、版本链以及行锁和间隙锁机制。",
	],
	[
		"Mysql/MySQL 索引底层与优化",
		"解释 InnoDB 选择 B+ 树的原因、页结构和聚簇索引，并总结联合索引与查询优化原则。",
	],
	[
		"Mysql/MySQL 主从架构与读写分离",
		"解析 Binlog 主从复制流程、延迟成因和读写路由，并比较写后读、缓存等一致性方案。",
	],
	[
		"Mysql/MySQL Buffer Pool 与 Change Buffer",
		"讲解 Buffer Pool 的页缓存与改进 LRU，以及 Change Buffer 如何降低非唯一索引的随机写入。",
	],
	[
		"Mysql/MySQL Using filesort 调优",
		"澄清 Using filesort 的真实含义，比较内存与磁盘排序路径，并整理 ORDER BY 的索引优化方法。",
	],
	[
		"Redis/数据结构：Hash 哈希底层原理",
		"解析 Redis Hash 在 Listpack 与哈希表之间的编码切换，以及内存占用和查询效率的权衡。",
	],
	[
		"Redis/数据结构：List 列表底层原理",
		"回顾 Redis List 从双向链表、Ziplist 到 Quicklist 的演进，并解释节点压缩与性能取舍。",
	],
	[
		"Redis/数据结构：String 与 SDS 底层原理",
		"介绍 SDS 的长度记录、空间预分配和惰性释放机制，并比较它与传统 C 字符串的安全性和效率。",
	],
]);
const postOverrides = new Map([
	[
		"Go/从 Channel 到 Future：用 Go 实现 Async-Await 模型",
		{
			title: "从 Channel 到 Future：用 Go 实现 Async/Await 模型",
		},
	],
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
	const curatedDescription = curatedDescriptions.get(articleKey);
	assert.ok(curatedDescription, `缺少文章摘要: ${articleKey}`);
	const description = resolvePostDescriptionResult(
		note.data,
		note.title,
		curatedDescription,
	);
	const frontmatter = {
		title: note.title,
		published: normalizeDate(note.data.created, note.modifiedAt),
		description: description.content,
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
	if (override.title) {
		body = body.replace(
			/^#\s+从 Channel 到 Future：用 Go 实现 Async\/Await 模型\s*(?:\r?\n)+/,
			"",
		);
	}
	body = convertObsidianLinks(body, registry);
	body = normalizeFenceLanguages(body);
	const sanitized = sanitizeSecrets(body);

	return {
		content: `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n${sanitized.content.trim()}\n`,
		redactionCount: description.redactionCount + sanitized.redactionCount,
	};
}

function assertInventory(notes) {
	assert.equal(notes.length, 57, "导入清单必须恰好包含 57 篇笔记");
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
