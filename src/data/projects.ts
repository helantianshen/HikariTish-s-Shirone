/**
 * 项目页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/projectsConfig.ts 控制。
 */
import type { ProjectItem } from "@/types/projectsConfig";

export const projectsData: ProjectItem[] = [
	{
		key: "gantry",
		title: "Gantry",
		summary:
			"面向单机 Docker 的轻量发布平台，以 Go、RabbitMQ、Redis 和 MySQL 构建可执行、可恢复、可观察的发布流程，并提供 Vue 管理台。",
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
			"自托管的 Obsidian 同步、分享与协作系统，支持多 Vault、离线优先、版本历史、冲突处理、公开分享和多人协作。",
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
		phase: "building",
		technologies: ["C++23", "Coroutines", "C++ Modules", "Async I/O"],
		icon: "material-symbols:memory-rounded",
		repository: "https://github.com/mcpplibs/cmp",
		year: "2026",
	},
	{
		key: "mcpp",
		title: "mcpp",
		summary:
			"面向 C++23 Modules 的现代构建工具，以纯 C++ 模块实现并完成自举，集成增量构建、依赖管理、锁文件、工作区和隔离工具链。",
		category: "cpp",
		phase: "building",
		technologies: ["C++23", "C++ Modules", "Build Tool", "Package Manager"],
		icon: "material-symbols:construction-rounded",
		website: "https://mcpplibs.github.io/mcpp-index",
		repository: "https://github.com/mcpp-community/mcpp",
		year: "2026",
	},
	{
		key: "fish-breeding-manager",
		title: "Fish Breeding Manager",
		summary: "为 Minecraft 原版与模组鱼类提供可配置繁殖支持的 Java 模组。",
		category: "game",
		phase: "building",
		technologies: ["Java", "Minecraft", "Modding"],
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
			"基于 Go 与 CloudWeGo Netpoll 的高性能云原生 API 网关，采用 Reactor、零拷贝和无锁架构，并支持 Nacos 动态热更新。",
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
