/**
 * 友情链接数据配置（结构与 Mizuki 同款，便于互相迁移）。
 * 用于管理友情链接页面的数据：src/pages/friends.astro → organisms/FriendSection。
 *
 * 添加友链：在 friendsData 中追加一项即可，页面 / 筛选标签自动生成。
 * tags 会聚合为页面顶部的筛选 chip（OR 命中：选中多个标签时命中任一即显示）。
 */
export interface FriendItem {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
}

// 友情链接数据
export const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "HikariLan's Blog",
		imgurl: "/assets/friends/blog-hikarilan-life-d792025f.png",
		desc: "贺兰星辰记录技术、日常与个人思考的博客。",
		siteurl: "https://blog.hikarilan.life/?ref=www.perass.com",
		tags: ["博客", "技术", "生活"],
	},
	{
		id: 2,
		title: "言峰 Sunrisepeak",
		imgurl: "/assets/friends/whois-d2learn-org-78139f30.png",
		desc: "观察者、探索者和开发者，分享开源、技术与生活。",
		siteurl: "https://whois.d2learn.org/Sunrisepeak/",
		tags: ["博客", "开源", "技术"],
	},
	{
		id: 3,
		title: "恋恋风辰",
		imgurl: "/assets/friends/llfc-club-9e66fb4a.ico",
		desc: "聚焦 C++、Go、并发与服务端开发的技术博客。",
		siteurl: "https://llfc.club/",
		tags: ["博客", "C++", "后端"],
	},
	{
		id: 4,
		title: "枫枫知道",
		imgurl: "/assets/friends/fengfengzhidao-com-3813f662.png",
		desc: "分享 Go、Vue、Nuxt、项目部署、AI Coding 与全栈开发经验。",
		siteurl: "https://www.fengfengzhidao.com/",
		tags: ["博客", "全栈", "AI"],
	},
	{
		id: 5,
		title: "Async Area",
		imgurl: "/assets/friends/async-area-com-ebf747db.png",
		desc: "软件开发与技术实践笔记。",
		siteurl: "https://async-area.com/",
		tags: ["博客", "技术"],
	},
	{
		id: 6,
		title: "天行1st的博客",
		imgurl: "/assets/friends/tx1st-cn-04f3ff08.png",
		desc: "记录 Kubernetes、KubeSphere、Golang、Docker 与运维实践。",
		siteurl: "https://tx1st.cn/",
		tags: ["博客", "云原生", "运维"],
	},
	{
		id: 7,
		title: "午安大电牛",
		imgurl: "/assets/friends/njfu-yangfan-top.ico",
		desc: "嵌入式与电力电子软件工程师，主攻阳台光伏",
		siteurl: "https://www.njfu-yangfan.top/",
		tags: ["博客", "技术", "生活"],
	},
	{
		id: 8,
		title: "兰舟千帆之博客",
		imgurl: "/assets/friends/daodaozi-xyz.webp",
		desc: "浮生若梦，为欢几何",
		siteurl: "https://daodaozi.xyz/",
		tags: ["博客", "生活"],
	},
	{
		id: 9,
		title: "阳光开朗大男孩",
		imgurl: "/assets/friends/gysy-ltd.jpg",
		desc: "躺平中。。。",
		siteurl: "https://gysy.ltd/",
		tags: ["博客", "技术"],
	},
];

// 获取所有友情链接数据（稳定顺序，测试可复现）
export function getFriendsList(): FriendItem[] {
	return friendsData;
}

// 获取随机排序的友情链接数据（避免固定排序，按需使用）
export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
