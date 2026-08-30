/**
 * 番剧收藏数据（本地数据源）。
 * 用于番剧页：src/pages/anime.astro → organisms/AnimeSection → molecules/AnimeCard。
 *
 * 添加条目：在 animeData 中追加一项即可，状态筛选 chips 与计数自动生成。
 * - cover 省略时卡片显示主题色渐变占位（补图前不破版）；
 * - link 省略时封面不可点；rating 为 0-10 个人评分；
 * - progress 是结构化追番进度，watching 状态在卡片上渲染进度条。
 * JSON 数据源（外部收藏服务拉取）见 utils/anime-data.ts 的 AnimeSource 分发。
 */

import type { AnimeIdentity } from "../types/animeConfig.ts";

/** 收藏状态（Bangumi 领域通行五态） */
export type AnimeStatus =
	| "watching"
	| "completed"
	| "planned"
	| "onHold"
	| "dropped";

export interface AnimeItem {
	title: string;
	/** 封面图地址（相对 /public 或绝对 URL）；省略 = 渐变占位 */
	cover?: string;
	/** 条目外链（Bangumi/官方站等）；省略则封面不可点 */
	link?: string;
	status: AnimeStatus;
	/** 个人评分 0-10 */
	rating: number;
	/** 追番进度：已看 / 总集数 */
	progress: { watched: number; total: number };
	/** 一句话感想 */
	description?: string;
	/** 放送年份（展示用） */
	year: string;
	/** 制作公司 */
	studio?: string;
	/** 题材标签 */
	genres: string[];
	/** 观看时间段（年-月） */
	period?: { start: string; end: string };
	/** 条目来源身份标识（可选，用于跨源去重与归档） */
	identity?: AnimeIdentity;
}

export const animeData: AnimeItem[] = [
	{
		title: "莉可丽丝",
		cover: "/assets/anime/covers/lycoris-recoil.webp",
		link: "https://bgm.tv/subject/364450",
		status: "completed",
		rating: 9.8,
		progress: { watched: 13, total: 13 },
		description: "咖啡店日常与少女特工行动交织的原创动画。",
		year: "2022",
		studio: "A-1 Pictures",
		genres: ["动作", "日常"],
		period: { start: "2022-07", end: "2022-09" },
		identity: { provider: "bangumi", subjectId: "364450" },
	},
	{
		title: "间谍过家家 第一季",
		cover: "/assets/anime/covers/spy-family-s1.webp",
		link: "https://bgm.tv/subject/329906",
		status: "completed",
		rating: 0,
		progress: { watched: 25, total: 25 },
		description: "临时组成的一家三口，各自藏着不能说的身份。",
		year: "2022",
		studio: "WIT STUDIO / CloverWorks",
		genres: ["喜剧", "家庭", "间谍"],
		identity: { provider: "bangumi", subjectId: "329906" },
	},
	{
		title: "间谍过家家 第二季",
		cover: "/assets/anime/covers/spy-family-s2.webp",
		link: "https://bgm.tv/subject/411427",
		status: "watching",
		rating: 0,
		progress: { watched: 4, total: 12 },
		description: "福杰一家的任务与日常继续展开。",
		year: "2023",
		studio: "WIT STUDIO / CloverWorks",
		genres: ["喜剧", "家庭", "间谍"],
		identity: { provider: "bangumi", subjectId: "411427" },
	},
	{
		title: "茉莉花酱的好感度正在崩坏",
		cover: "/assets/anime/covers/marika-love-meter.webp",
		link: "https://bgm.tv/subject/609183",
		status: "watching",
		rating: 0,
		progress: { watched: 7, total: 8 },
		description: "能看见好感度后，青梅竹马的数值却彻底坏掉了。",
		year: "2026",
		studio: "Studio Leo",
		genres: ["恋爱", "校园", "喜剧"],
		identity: { provider: "bangumi", subjectId: "609183" },
	},
	{
		title: "Re：从零开始的异世界生活 第一季",
		cover: "/assets/anime/covers/rezero-s1.webp",
		link: "https://bgm.tv/subject/140001",
		status: "completed",
		rating: 0,
		progress: { watched: 25, total: 25 },
		description: "以死亡回归为起点的异世界冒险。",
		year: "2016",
		studio: "WHITE FOX",
		genres: ["异世界", "奇幻", "冒险"],
		identity: { provider: "bangumi", subjectId: "140001" },
	},
	{
		title: "Re：从零开始的异世界生活 第二季",
		cover: "/assets/anime/covers/rezero-s2.webp",
		link: "https://bgm.tv/subject/278826",
		status: "completed",
		rating: 0,
		progress: { watched: 25, total: 25 },
		description: "圣域试炼与魔女茶会带来更深的选择。",
		year: "2020",
		studio: "WHITE FOX",
		genres: ["异世界", "奇幻", "冒险"],
		identity: { provider: "bangumi", subjectId: "278826" },
	},
	{
		title: "Re：从零开始的异世界生活 第三季",
		cover: "/assets/anime/covers/rezero-s3.webp",
		link: "https://bgm.tv/subject/425998",
		status: "completed",
		rating: 0,
		progress: { watched: 16, total: 16 },
		description: "水门都市篇与反击篇的连续战斗。",
		year: "2024",
		studio: "WHITE FOX",
		genres: ["异世界", "奇幻", "战斗"],
		identity: { provider: "bangumi", subjectId: "425998" },
	},
	{
		title: "Re：从零开始的异世界生活 第四季",
		cover: "/assets/anime/covers/rezero-s4.webp",
		link: "https://bgm.tv/subject/547888",
		status: "watching",
		rating: 0,
		progress: { watched: 14, total: 14 },
		description: "第四季持续追番中。",
		year: "2026",
		studio: "WHITE FOX",
		genres: ["异世界", "奇幻", "冒险"],
		identity: { provider: "bangumi", subjectId: "547888" },
	},
	{
		title: "约会大作战",
		cover: "/assets/anime/covers/date-a-live.webp",
		link: "https://bgm.tv/subject/49131",
		status: "watching",
		rating: 0,
		progress: { watched: 9, total: 13 },
		description: "通过约会封印精灵力量的校园奇幻故事。",
		year: "2013",
		studio: "AIC PLUS+",
		genres: ["恋爱", "奇幻", "战斗"],
		identity: { provider: "bangumi", subjectId: "49131" },
	},
	{
		title: "关于邻家的天使大人不知不觉把我惯成了废人",
		cover: "/assets/anime/covers/angel-next-door.webp",
		link: "https://bgm.tv/subject/364822",
		status: "planned",
		rating: 0,
		progress: { watched: 0, total: 12 },
		description: "从一把雨伞开始的邻家青春恋爱故事。",
		year: "2023",
		studio: "project No.9",
		genres: ["恋爱", "校园", "日常"],
		identity: { provider: "bangumi", subjectId: "364822" },
	},
	{
		title: "总之就是非常可爱",
		cover: "/assets/anime/covers/tonikawa.webp",
		link: "https://bgm.tv/subject/301541",
		status: "planned",
		rating: 0,
		progress: { watched: 0, total: 12 },
		description: "从结婚开始的甜蜜新婚日常。",
		year: "2020",
		studio: "Seven Arcs",
		genres: ["恋爱", "喜剧", "日常"],
		identity: { provider: "bangumi", subjectId: "301541" },
	},
	{
		title: "前辈是男孩子",
		cover: "/assets/anime/covers/senpai-otokonoko.webp",
		link: "https://bgm.tv/subject/425988",
		status: "planned",
		rating: 0,
		progress: { watched: 0, total: 12 },
		description: "围绕自我认同与三人关系展开的青春故事。",
		year: "2024",
		studio: "project No.9",
		genres: ["校园", "青春", "恋爱"],
		identity: { provider: "bangumi", subjectId: "425988" },
	},
	{
		title: "紫罗兰永恒花园",
		cover: "/assets/anime/covers/violet-evergarden.webp",
		link: "https://bgm.tv/subject/183878",
		status: "completed",
		rating: 0,
		progress: { watched: 13, total: 13 },
		description: "以书信理解感情，也逐步理解那句“我爱你”。",
		year: "2018",
		studio: "京都动画",
		genres: ["剧情", "治愈"],
		identity: { provider: "bangumi", subjectId: "183878" },
	},
	{
		title: "更衣人偶坠入爱河",
		cover: "/assets/anime/covers/my-dress-up-darling.webp",
		link: "https://bgm.tv/subject/333158",
		status: "planned",
		rating: 0,
		progress: { watched: 0, total: 12 },
		description: "从雏人偶制作与 Cosplay 相遇开始的校园恋爱喜剧。",
		year: "2022",
		studio: "CloverWorks",
		genres: ["恋爱", "校园", "喜剧"],
		identity: { provider: "bangumi", subjectId: "333158" },
	},
	{
		title: "Fate 系列",
		cover: "/assets/anime/covers/fate-ubw.webp",
		link: "https://bgm.tv/subject/95225",
		status: "planned",
		rating: 0,
		progress: { watched: 0, total: 26 },
		description:
			"暂以《Fate/stay night [Unlimited Blade Works]》作为系列入口。",
		year: "2014",
		studio: "ufotable",
		genres: ["奇幻", "战斗"],
		identity: { provider: "bangumi", subjectId: "95225" },
	},
];
