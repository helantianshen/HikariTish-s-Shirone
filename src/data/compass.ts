/**
 * 站点罗盘数据（本地数据源）。
 * 用途：src/pages/compass.astro → organisms/CompassSection → molecules/CompassTile。
 * 添加站点：往对应 Shelf.entries 追加一项；数组顺序即展示顺序。
 * - icon：Iconify 名（material-symbols:xxx）或图片 URL（http(s)/绝对路径）；
 *   省略时瓷砖显示 label 首字母 tonal 块（不自动抓取 favicon）。
 * - image：用户自定义图片 URL（http(s)/绝对路径），优先于 icon 渲染；
 *   加载失败自动降级为首字母块。
 * - 本地站点 logo 缓存在 public/assets/compass/；运行 `pnpm.cmd compass:icons`
 *   可从站点声明的 favicon 刷新缓存，失败时使用已安装的品牌图标。
 */

/** 单条站点记录 */
export interface CompassEntry {
	/** 站点名（瓷砖标题） */
	label: string;
	/** 外链地址 */
	href: string;
	/** 一句话说明（瓷砖副行；省略则显示域名） */
	note?: string;
	/** 图标：Iconify 名或图片 URL；省略 = 首字母兜底 */
	icon?: string;
	/** 用户自定义图片（http(s)/绝对路径）：优先于 icon 渲染；省略则走 icon/首字母 */
	image?: string;
}

/** 分组（Shelf = 罗盘上的收纳格） */
export interface CompassShelf {
	/** 锚点 id（字母数字，作分组定位与跳转） */
	key: string;
	/** 分组名 */
	name: string;
	/** 分组图标（Iconify 名，SectionTitle 行首） */
	icon?: string;
	/** 分组副文案（标题下弱文本，可选） */
	blurb?: string;
	entries: CompassEntry[];
}

export const compassData: CompassShelf[] = [
	{
		key: "dev",
		name: "开发",
		icon: "material-symbols:code-rounded",
		blurb: "开发文档、数据库与技术社区",
		entries: [
			{
				label: "Forge 文档",
				href: "https://docs.minecraftforge.net/en/1.20.x/gettingstarted/",
				image: "/assets/compass/docs-minecraftforge-net-1f8497e3.png",
				note: "Forge 1.20.x 入门文档",
			},
			{
				label: "GreptimeDB",
				href: "https://greptime.cn/",
				icon: "material-symbols:database-rounded",
				note: "GreptimeDB 官方网站",
			},
			{
				label: "GoClub",
				href: "https://goclub.space/",
				image: "/assets/compass/goclub-space-5c884bc1.png",
				note: "Go 开发者社区入口",
			},
		],
	},
	{
		key: "learning",
		name: "学习",
		icon: "material-symbols:school-outline-rounded",
		blurb: "算法、语言、架构与面试资料",
		entries: [
			{
				label: "LeetCode",
				href: "https://leetcode.cn/studyplan/top-100-liked/",
				image: "/assets/compass/leetcode-cn-da8c5977.png",
				note: "热门算法题学习计划",
			},
			{
				label: "学习示例",
				href: "https://quickref.me/",
				image: "/assets/compass/quickref-me-b2a6aabf.png",
				note: "常用语言与工具速查表",
			},
			{
				label: "Rust 文档",
				href: "https://doc.rust-lang.org/book/",
				image: "/assets/compass/doc-rust-lang-org-f4441b18.png",
				note: "Rust 官方语言教程",
			},
			{
				label: "凤凰架构",
				href: "https://icyfenix.cn/",
				icon: "material-symbols:school-outline-rounded",
				note: "软件架构与分布式系统资料",
			},
			{
				label: "代码随想录",
				href: "https://programmercarl.com/algo/",
				image: "/assets/compass/programmercarl-com-cd7ae239.png",
				note: "算法与数据结构学习资料",
			},
			{
				label: "卡码笔记",
				href: "https://notes.kamacoder.com/bagu/2JXfrApD66i",
				icon: "material-symbols:notes-rounded",
				note: "技术知识与面试笔记",
			},
			{
				label: "面试鸭",
				href: "https://www.mianshiya.com/",
				image: "/assets/compass/mianshiya-com-c41f5822.png",
				note: "程序员面试题库与学习路线",
			},
		],
	},
	{
		key: "ops",
		name: "运维",
		icon: "material-symbols:dns-outline-rounded",
		blurb: "服务器、面板、托管与站点控制台",
		entries: [
			{
				label: "北京云 1Panel",
				href: "http://103.36.220.189:23649/yoga",
				icon: "material-symbols:dns-outline-rounded",
				note: "北京云服务器管理入口",
			},
			{
				label: "物理机 1Panel",
				href: "http://192.168.148.8:23402/yoga",
				icon: "material-symbols:dns-outline-rounded",
				note: "本地物理机管理入口",
			},
			{
				label: "物理机 MCS",
				href: "http://192.168.148.8:23333/#/instances",
				icon: "material-symbols:sports-esports-outline-rounded",
				note: "本地 MCS 实例管理入口",
			},
			{
				label: "雨云 MCS",
				href: "https://mcsm.rainyun.com/#/customer",
				icon: "material-symbols:cloud-outline-rounded",
				note: "雨云 MCS 客户控制台",
			},
			{
				label: "Cloudflare 主页",
				href: "https://dash.cloudflare.com/09d7105f82d5334496241c9ad210eecb/home/overview",
				image: "/assets/compass/dash-cloudflare-com-15c1a07e.png",
				note: "Cloudflare 账户概览",
			},
			{
				label: "K-Vault 免费文件托管服务",
				href: "https://vault.gyvv.top/",
				image: "/assets/compass/vault-gyvv-top-0ac467ae.png",
				note: "文件托管服务入口",
			},
			{
				label: "海外 VPS 主机",
				href: "https://www.hostinger.com/hk/vps-hosting#pricing",
				image: "/assets/compass/hostinger-com-043e2501.png",
				note: "Hostinger VPS 主机方案",
			},
			{
				label: "EdgeOne 控制台",
				href: "https://console.cloud.tencent.com/edgeone/makers/project/makers-7mfwvqxtjzwj/index?name=hikaritish-shirone",
				icon: "material-symbols:cloud-outline-rounded",
				note: "Shirone 站点 EdgeOne 项目控制台",
			},
		],
	},
	{
		key: "magic",
		name: "魔法",
		icon: "material-symbols:encrypted-outline-rounded",
		blurb: "网络服务与线路参考",
		entries: [
			{
				label: "2026 稳定机场推荐",
				href: "https://flyvpn88.top/",
				icon: "material-symbols:encrypted-outline-rounded",
				note: "机场与线路推荐信息",
			},
			{
				label: "良心云 - 仪表盘",
				href: "https://xn--9kqz23b19z.com/#/dashboard",
				icon: "material-symbols:encrypted-outline-rounded",
				note: "良心云服务仪表盘",
			},
			{
				label: "开速云 - 仪表盘",
				href: "http://xksy.kshost.cn:30001/welcome",
				image: "/assets/compass/xksy-kshost-cn-b087f317.png",
				note: "开速云服务仪表盘",
			},
		],
	},
	{
		key: "frontend",
		name: "前端",
		icon: "material-symbols:palette-outline-rounded",
		blurb: "组件库、动效框架与矢量资源",
		entries: [
			{
				label: "阿里巴巴矢量图标库",
				href: "https://www.iconfont.cn/collections/index?spm=a313x.home_index.i1.1.58a33a81V6Rm7D",
				image: "/assets/compass/iconfont-cn-9423a521.png",
				note: "Iconfont 图标资源集合",
			},
			{
				label: "Anime.js",
				href: "https://animejs.com/",
				image: "/assets/compass/animejs-com-c0d7dabb.png",
				note: "JavaScript 动画引擎",
			},
			{
				label: "NutUI",
				href: "https://nutui.jd.com/#/",
				image: "/assets/compass/nutui-jd-com-882d20a7.png",
				note: "移动端 Vue 组件库",
			},
			{
				label: "DevUI",
				href: "https://devui.design/components/zh-cn/overview",
				image: "/assets/compass/devui-design-242baf87.png",
				note: "企业级前端组件库",
			},
			{
				label: "Ant Design",
				href: "https://ant.design/components/overview-cn",
				image: "/assets/compass/ant-design-832d5c18.png",
				note: "Ant Design 组件总览",
			},
			{
				label: "PrimeVue",
				href: "https://primevue.cn/card/",
				image: "/assets/compass/primevue-cn-dbf40ef0.png",
				note: "Vue UI 组件库",
			},
			{
				label: "Element Plus",
				href: "https://element-plus.org/zh-CN/component/overview",
				image: "/assets/compass/element-plus-org-6c5d299a.png",
				note: "Vue 3 组件库",
			},
			{
				label: "GSAP",
				href: "https://gsap.com/",
				image: "/assets/compass/gsap-com-6c668d3c.png",
				note: "Web 动画开发平台",
			},
		],
	},
	{
		key: "games",
		name: "游戏",
		icon: "material-symbols:sports-esports-outline-rounded",
		blurb: "游戏与休闲内容入口",
		entries: [
			{
				label: "蒸汽游戏宝库",
				href: "https://www.steambk.com/",
				image: "/assets/compass/steambk-com-d2f1371c.png",
				note: "Steam 游戏资源入口",
			},
			{
				label: "包子漫画",
				href: "https://cn.baozimhcn.com/",
				image: "/assets/compass/cn-baozimhcn-com-86efb2b5.png",
				note: "漫画阅读入口",
			},
		],
	},
	{
		key: "ai",
		name: "AI",
		icon: "material-symbols:smart-toy-outline-rounded",
		blurb: "AI 产品、开发平台与 API 服务",
		entries: [
			{
				label: "Google Gemini",
				href: "https://gemini.google.com/app",
				image: "/assets/compass/gemini-google-com-380e7aa2.png",
				note: "Gemini 对话应用",
			},
			{
				label: "Google AI Studio",
				href: "https://aistudio.google.com/",
				image: "/assets/compass/aistudio-google-com-86e7d7fc.png",
				note: "Google AI 模型开发平台",
			},
			{
				label: "ChatGPT",
				href: "https://chatgpt.com/",
				image: "/assets/compass/chatgpt-com-5d9354f7.png",
				note: "ChatGPT 对话应用",
			},
			{
				label: "OpenCode",
				href: "https://opencode.ai/workspace/wrk_01KVB18JYHPQNAR0R9MHRT0PA3/go",
				image: "/assets/compass/opencode-ai-141c068e.png",
				note: "OpenCode 工作区",
			},
			{
				label: "Umans",
				href: "https://app.umans.ai/billing?context=personal&tab=get-started",
				image: "/assets/compass/app-umans-ai-6054549c.png",
				note: "Umans 个人账户入口",
			},
			{
				label: "千问",
				href: "https://www.qianwen.com/?ch=webtongyi@sem_360mt360semwebty1_wbzy2_1&planid=2227276185&unitid=58862482&a_keywordid=74801752157&a_creative=11276285309&from=360sem&aid=3632490730&tag=&qhclickid=c81745c3d6bfbb8c",
				image: "/assets/compass/qianwen-com-c035a0c4.png",
				note: "千问 AI 助手",
			},
			{
				label: "Kimi Code",
				href: "https://www.kimi.com/",
				image: "/assets/compass/kimi-com-fc152ff6.png",
				note: "Kimi AI 助手入口",
			},
			{
				label: "DeepSeek 开放平台",
				href: "https://platform.deepseek.com/usage",
				image: "/assets/compass/platform-deepseek-com-4a14f178.png",
				note: "DeepSeek API 用量与平台入口",
			},
			{
				label: "GLM AI",
				href: "https://bigmodel.cn/",
				image: "/assets/compass/bigmodel-cn-6a6011a5.png",
				note: "智谱大模型开放平台",
			},
			{
				label: "LMSpeed",
				href: "https://lmspeed.net/zh/provider/category/free",
				image: "/assets/compass/lmspeed-net-095952e1.png",
				note: "免费模型服务商列表",
			},
			{
				label: "G佬中转站",
				href: "https://newapi.gysy.ltd/console",
				image: "/assets/compass/newapi-gysy-ltd-93000af8.png",
				note: "AI API 中转控制台",
			},
			{
				label: "Liminality 中转站",
				href: "https://beizhi.sylu.cc/dashboard/models",
				image: "/assets/compass/beizhi-sylu-cc-aa16fb6a.png",
				note: "AI API 模型面板",
			},
			{
				label: "xinfeng 中转站",
				href: "https://xinfeng.best/dashboard/models",
				image: "/assets/compass/xinfeng-best-9a2864e8.png",
				note: "AI API 模型面板",
			},
			{
				label: "AI2API 中转站",
				href: "https://ai2api.cc/dashboard",
				image: "/assets/compass/ai2api-cc-25a3b1e3.png",
				note: "AI API 中转控制台",
			},
			{
				label: "酸奶中转站",
				href: "https://closedai.kylenqaq.com/dashboard/models",
				image: "/assets/compass/closedai-kylenqaq-com-3a586cb3.png",
				note: "AI API 模型面板",
			},
			{
				label: "Just Do Work 中转站",
				href: "https://api.justwoker.icu/dashboard/overview",
				image: "/assets/compass/api-justwoker-icu-54626bec.png",
				note: "AI API 中转控制台",
			},
			{
				label: "Cloud API 中转站",
				href: "https://api.yspbwx2010.cc/dashboard/overview",
				image: "/assets/compass/api-yspbwx2010-cc-4879272e.png",
				note: "AI API 中转控制台",
			},
			{
				label: "LinkAPI",
				href: "https://ai.gs88.shop/dashboard",
				image: "/assets/compass/ai-gs88-shop-c5edf9da.png",
				note: "AI API 服务面板",
			},
			{
				label: "Mirasim",
				href: "https://mirasim.ai/#product",
				image: "/assets/compass/mirasim-ai-0f3168f1.png",
				note: "Mirasim AI 产品入口",
			},
		],
	},
	{
		key: "tools",
		name: "工具",
		icon: "material-symbols:build-outline-rounded",
		blurb: "文档、邮箱、笔记与日常实用工具",
		entries: [
			{
				label: "飞书云文档",
				href: "https://hcnmi9ccuug9.feishu.cn/drive/home/",
				image: "/assets/compass/hcnmi9ccuug9-feishu-cn-5c48f868.png",
				note: "飞书云文档空间",
			},
			{
				label: "Gmail",
				href: "https://mail.google.com/mail/u/0/#inbox",
				image: "/assets/compass/mail-google-com-db902c3a.png",
				note: "Gmail 收件箱",
			},
			{
				label: "云同步笔记",
				href: "https://note.guyuan-v.top/webgui/?notes&vault=Note",
				icon: "material-symbols:cloud-rounded",
				note: "云端笔记库入口",
			},
			{
				label: "音效配乐素材网站",
				href: "https://www.aigei.com/",
				icon: "material-symbols:music-note-rounded",
				note: "音效、配乐与创作素材",
			},
			{
				label: "2FA 验证码",
				href: "https://2fa.show/",
				icon: "material-symbols:key-rounded",
				note: "双因素验证码工具",
			},
		],
	},
];
