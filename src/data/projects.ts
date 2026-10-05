/**
 * 项目页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/projectsConfig.ts 控制。
 */
import type { ProjectItem } from "@/types/projectsConfig";

export const projectsData: ProjectItem[] = [
	{
		key: "gateway",
		title: "Gateway",
		summary:
			"以 Go 标准库为核心的轻量 HTTP 网关，支持 Host、Method 与路径路由、轮询转发、共享连接池、优雅停机和 Prometheus 指标，目前处于静态数据面的维护期。",
		category: "backend",
		phase: "building",
		technologies: [
			"Go",
			"net/http",
			"ReverseProxy",
			"Radix Tree",
			"Prometheus",
		],
		icon: "material-symbols:route-rounded",
		cover: "/assets/projects/gateway.png",
		coverAlt: "Gateway 项目封面",
		featured: true,
		repository: "https://github.com/helantianshen/Gateway",
		year: "2026",
	},
	{
		key: "gantry",
		title: "Gantry",
		summary:
			"面向单机 Docker 的轻量发布平台 MVP，通过 RabbitMQ、Redis 应用锁与 MySQL lease 执行容器切换，支持健康检查、故障恢复、发布审计与 Vue 管理台。",
		category: "devops",
		phase: "building",
		technologies: ["Go", "Vue 3", "Docker", "RabbitMQ", "Redis", "MySQL"],
		icon: "material-symbols:deployed-code-outline-rounded",
		cover: "/assets/projects/gantry.webp",
		coverAlt: "Gantry 项目封面",
		featured: true,
		repository: "https://github.com/helantianshen/gantry",
		year: "2026",
	},
	{
		key: "oss-sync",
		title: "OSS Sync",
		summary:
			"自托管的 Obsidian 同步、分享与协作系统，以单个服务端二进制提供多 Vault 同步、离线队列、冲突处理、版本历史、公开博客和服务端插件扩展。",
		category: "productivity",
		phase: "shipped",
		technologies: ["Go", "TypeScript", "Obsidian", "SQLite", "PostgreSQL"],
		icon: "material-symbols:sync-rounded",
		repository: "https://github.com/helantianshen/oss-sync",
		year: "2026",
	},
	{
		key: "cmp",
		title: "CMP",
		summary:
			"基于 C++23 标准协程与模块构建的现代协程运行时，提供结构化并发、事件、异步互斥、调度器、线程池和原生异步 TCP 能力。",
		category: "cpp",
		phase: "shipped",
		technologies: ["C++23", "Coroutines", "C++ Modules", "Async I/O"],
		icon: "material-symbols:memory-rounded",
		repository: "https://github.com/mcpplibs/cmp",
		year: "2026",
	},
	{
		key: "mcpp",
		title: "mcpp",
		summary:
			"面向 C++23 Modules 的自举构建工具，集成增量构建、依赖与锁文件管理、构建插件、隔离工具链和交叉编译；已发布版本，仍处于早期开发阶段。",
		category: "cpp",
		phase: "shipped",
		technologies: ["C++23", "C++ Modules", "Build Tool", "Package Manager"],
		icon: "material-symbols:construction-rounded",
		website: "https://mcpp.index.xlings.org/",
		repository: "https://github.com/mcpp-community/mcpp",
		year: "2026",
	},
	{
		key: "xim-index",
		title: "xim-pkgindex",
		summary:
			"xlings 的软件与开发环境包索引，通过 Lua 配方管理应用、工具链、库和配置，参与软件版本更新、安装适配与资源校验。",
		category: "devops",
		phase: "shipped",
		technologies: ["Lua", "xlings", "Package Index", "CI"],
		icon: "material-symbols:inventory-2-outline-rounded",
		website: "https://openxlings.github.io/xim-pkgindex/",
		repository: "https://github.com/openxlings/xim-pkgindex",
		year: "2026",
	},
	{
		key: "mcpp-index",
		title: "mcpp-index",
		summary:
			"mcpp 默认的 C++23 包索引，收录原生模块库与第三方 C/C++ 兼容包，参与包描述、模块适配、构建钩子和跨工具链验证。",
		category: "cpp",
		phase: "shipped",
		technologies: ["Lua", "C++23", "C++ Modules", "mcpp", "CI"],
		icon: "material-symbols:package-2-outline-rounded",
		website: "https://mcpp.index.xlings.org/",
		repository: "https://github.com/mcpplibs/mcpp-index",
		year: "2026",
	},
	{
		key: "fish-breeding-manager",
		title: "Fish Breeding Manager",
		summary:
			"为 Minecraft 原版与模组鱼类提供可配置繁殖支持的 NeoForge 模组，包含管理界面与食物识别，目前已发布 v0.2.0 预览版。",
		category: "game",
		phase: "shipped",
		technologies: ["Java", "Minecraft", "NeoForge"],
		icon: "material-symbols:pets-rounded",
		cover: "/assets/projects/fish-breeding-manager.webp",
		coverAlt: "Fish Breeding Manager 项目封面",
		repository: "https://github.com/helantianshen/FishBreedingManager",
		year: "2026",
	},
	{
		key: "jianjia-nexus-website",
		title: "蒹葭综合体官网",
		summary:
			"使用 Next.js 14、Tailwind CSS 与 Framer Motion 打造的双语官网，包含粒子星空、滚动视差、动态光晕和响应式交互动效。",
		category: "frontend",
		phase: "shipped",
		technologies: ["Next.js 14", "TypeScript", "Tailwind CSS", "Framer Motion"],
		icon: "material-symbols:web-rounded",
		cover: "/assets/projects/jianjia-nexus-website.webp",
		coverAlt: "蒹葭综合体官网项目封面",
		repository:
			"https://github.com/helantianshen/JianJiaNexus-OfficialWebsite-Frontend",
		year: "2026",
	},
	{
		key: "novagate",
		title: "NovaGate",
		summary:
			"基于 Go 与 CloudWeGo Netpoll 的网关实验项目，使用 Reactor 网络模型、连接池和 Nacos 配置热更新，探索代理转发与限流机制。",
		category: "backend",
		phase: "building",
		technologies: ["Go", "CloudWeGo Netpoll", "Nacos", "Reactor", "Zero-Copy"],
		icon: "material-symbols:route-rounded",
		repository: "https://github.com/helantianshen/NovaGate",
		year: "2026",
	},
	{
		key: "novanexus",
		title: "NovaNexus",
		summary:
			"基于 CloudWeGo 生态构建的微服务即时通讯平台，覆盖实时推送、离线补推、消息历史、好友关系、群组权限和在线状态。",
		category: "backend",
		phase: "building",
		technologies: [
			"Go",
			"Hertz",
			"Kitex",
			"MySQL",
			"Redis",
			"RabbitMQ",
			"etcd",
		],
		icon: "material-symbols:forum-rounded",
		repository: "https://github.com/helantianshen/NovaNexus",
		year: "2026",
	},
];

/** 获取所有项目数据列表 */
export function getProjectsList(): ProjectItem[] {
	return projectsData;
}
