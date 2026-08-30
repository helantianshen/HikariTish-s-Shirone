/**
 * 技能页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/skillsConfig.ts 控制。
 */
import type { SkillItem } from "@/types/skillsConfig";

export const skillsData: SkillItem[] = [
	{
		name: "Go",
		description: "高并发后端服务、网络程序与工程化工具链开发。",
		icon: "simple-icons:go",
		category: "languages",
		level: "expert",
	},
	{
		name: "Java",
		description: "JVM 后端服务、Spring 生态与大型项目维护。",
		icon: "simple-icons:openjdk",
		category: "languages",
		level: "expert",
	},
	{
		name: "Rust",
		description: "所有权模型、并发编程与高性能系统工具开发。",
		icon: "simple-icons:rust",
		category: "languages",
		level: "advanced",
	},
	{
		name: "Python",
		description: "自动化脚本、数据处理与服务端工具开发。",
		icon: "simple-icons:python",
		category: "languages",
		level: "advanced",
	},
	{
		name: "MySQL",
		description: "关系模型、事务、索引设计与查询性能优化。",
		icon: "simple-icons:mysql",
		category: "data-middleware",
		level: "advanced",
	},
	{
		name: "Redis",
		description: "缓存、数据结构、持久化与高可用方案。",
		icon: "simple-icons:redis",
		category: "data-middleware",
		level: "advanced",
	},
	{
		name: "Nginx",
		description: "反向代理、静态资源、TLS 与负载均衡配置。",
		icon: "simple-icons:nginx",
		category: "cloud-ops",
		level: "advanced",
	},
	{
		name: "Docker",
		description: "镜像构建、Compose 编排与容器化部署。",
		icon: "simple-icons:docker",
		category: "cloud-ops",
		level: "advanced",
	},
	{
		name: "RabbitMQ",
		description: "消息路由、可靠投递、确认重试与异步解耦。",
		icon: "simple-icons:rabbitmq",
		category: "data-middleware",
		level: "advanced",
	},
	{
		name: "C++",
		description: "现代 C++、异步编程与原生工具链开发。",
		icon: "simple-icons:cplusplus",
		category: "languages",
		level: "intermediate",
	},
	{
		name: "C",
		description: "底层系统接口、内存管理与基础程序开发。",
		icon: "simple-icons:c",
		category: "languages",
		level: "intermediate",
	},
	{
		name: "Vue",
		description: "Vue 组件开发、状态管理与前端工程化。",
		icon: "simple-icons:vuedotjs",
		category: "frontend-runtime",
		level: "intermediate",
	},
	{
		name: "Node.js",
		description: "服务端运行时、自动化脚本与前端构建工具。",
		icon: "simple-icons:nodedotjs",
		category: "frontend-runtime",
		level: "intermediate",
	},
	{
		name: "Kotlin",
		description: "现代 JVM 语法、空安全与应用程序开发。",
		icon: "simple-icons:kotlin",
		category: "languages",
		level: "intermediate",
	},
	{
		name: "PostgreSQL",
		description: "关系数据建模、复杂查询与事务能力。",
		icon: "simple-icons:postgresql",
		category: "data-middleware",
		level: "intermediate",
	},
	{
		name: "Elasticsearch",
		description: "索引设计、全文检索与聚合查询。",
		icon: "simple-icons:elasticsearch",
		category: "data-middleware",
		level: "intermediate",
	},
	{
		name: "Kubernetes (K8s)",
		description: "工作负载编排、服务发现与基础部署管理。",
		icon: "simple-icons:kubernetes",
		category: "cloud-ops",
		level: "intermediate",
	},
	{
		name: "JavaScript",
		description: "现代语法、异步流程与浏览器端交互开发。",
		icon: "simple-icons:javascript",
		category: "languages",
		level: "intermediate",
	},
	{
		name: "TypeScript",
		description: "类型建模、接口约束与可维护的前端工程。",
		icon: "simple-icons:typescript",
		category: "languages",
		level: "intermediate",
	},
	{
		name: "Verilog",
		description: "数字逻辑描述、基础模块设计与仿真。",
		icon: "material-symbols:memory-rounded",
		category: "languages",
		level: "beginner",
	},
	{
		name: "React",
		description: "组件、Hooks 与基础状态管理。",
		icon: "simple-icons:react",
		category: "frontend-runtime",
		level: "beginner",
	},
];

/** 获取所有技能数据列表 */
export function getSkillsList(): SkillItem[] {
	return skillsData;
}
