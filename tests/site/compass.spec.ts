import { expect, test } from "@playwright/test";

/**
 * 站点罗盘页功能锁定（pages/compass.astro -> organisms/CompassSection -> molecules/CompassTile，client:visible）。
 * 筛选与站内 friends/moments/anime 同一交互语言：
 * 分组 filter chips 单选（再点取消恢复全部）切换时走站内同款 LoadingIndicator 三段过渡
 * （loading → 淡出 → stagger 揭幕）；搜索即时过滤（每键收放，不闪加载器，与 MomentSection 分工一致），
 * 状态同步 URL（?group= / ?q=），刷新/分享/回退保留。
 * 分组标题与瓷砖均用站内既有语言（SectionTitle + card-bg 竖向卡），不引入额外装置。
 * 数据来自 src/data/compass.ts（本地数据源，8 组 / 55 条），
 * 站点入口按开发、学习、运维、魔法、前端、游戏、AI、工具分类。
 */

const SHELF_KEYS = [
	"dev",
	"learning",
	"ops",
	"magic",
	"frontend",
	"games",
	"ai",
	"tools",
];
const SHELF_NAMES: Record<string, string> = {
	dev: "开发",
	learning: "学习",
	ops: "运维",
	magic: "魔法",
	frontend: "前端",
	games: "游戏",
	ai: "AI",
	tools: "工具",
};
const SHELF_TILE_COUNTS: Record<string, number> = {
	dev: 3,
	learning: 7,
	ops: 8,
	magic: 3,
	frontend: 8,
	games: 2,
	ai: 19,
	tools: 5,
};
const ENTRY_COUNT = 55;

test.describe("站点罗盘页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/compass/");
		await expect(page.locator(".compass-tile")).toHaveCount(ENTRY_COUNT);
	});

	test("渲染分组与瓷砖（SectionTitle 标题行 / 每组条数 / 外链 / 本地图标）", async ({
		page,
	}) => {
		// 8 个分组 section，每组 tile 数与清单一致；标题行为站内 SectionTitle
		for (const key of SHELF_KEYS) {
			await expect(page.locator(`section[data-shelf="${key}"]`)).toHaveCount(1);
			await expect(
				page.locator(`section[data-shelf="${key}"] .compass-tile`),
			).toHaveCount(SHELF_TILE_COUNTS[key]);
			await expect(
				page.locator(`section[data-shelf="${key}"] .section-title__title`),
			).toHaveText(SHELF_NAMES[key]);
		}
		// 首 tile（Forge 文档）：label / 外链 / 新标签页
		const first = page.locator(".compass-tile").first();
		await expect(first.locator(".compass-tile__label")).toHaveText(
			"Forge 文档",
		);
		await expect(first.locator("a.compass-tile__link")).toHaveAttribute(
			"href",
			"https://docs.minecraftforge.net/en/1.20.x/gettingstarted/",
		);
		await expect(first.locator("a.compass-tile__link")).toHaveAttribute(
			"target",
			"_blank",
		);
		await expect(first.locator("a.compass-tile__link")).toHaveAttribute(
			"rel",
			/noopener/,
		);
		await expect(first.locator(".compass-tile__note")).toHaveText(
			"Forge 1.20.x 入门文档",
		);
		// 42 个站点 logo 缓存为本地 PNG，其余 13 个使用本地 Iconify 分类图标。
		await expect(first.locator(".compass-tile__icon img")).toHaveAttribute(
			"src",
			"/assets/compass/docs-minecraftforge-net-1f8497e3.png",
		);
		await expect(page.locator(".compass-tile__icon img")).toHaveCount(42);
		await expect(page.locator(".compass-tile__icon svg")).toHaveCount(13);
		await expect(page.locator(".compass-tile__letter")).toHaveCount(0);
		// 每个分类同时在筛选 chip 与 SectionTitle 中显示本地图标。
		await expect(
			page.locator(".compass-section__chips .m3-chip__icon svg"),
		).toHaveCount(8);
		await expect(page.locator(".section-title__icon svg")).toHaveCount(8);
		// 计数行
		await expect(page.locator(".compass-section__count")).toHaveText(
			"55 个站点",
		);
	});

	test("分组筛选：chips 单选过滤（三段 Loading 过渡 + 再点取消恢复，URL ?group= 同步）", async ({
		page,
	}) => {
		const frontendChip = page.getByRole("button", {
			name: "前端",
			exact: true,
		});
		// 选中 → 三段过渡（contained 指示器展示后淡出），收敛后只剩该组 + aria-pressed + URL 同步
		await frontendChip.click();
		await expect(frontendChip).toHaveAttribute("aria-pressed", "true");
		await expect(page).toHaveURL(/[?&]group=frontend/);
		await expect(
			page.locator(".compass-section__loading .m3-loading--contained"),
		).toBeVisible();
		await expect(page.locator(".compass-tile")).toHaveCount(8);
		await expect(page.locator(".compass-section__loading")).toHaveCount(0);
		await expect(page.locator('section[data-shelf="frontend"]')).toBeVisible();
		for (const key of SHELF_KEYS.filter((key) => key !== "frontend")) {
			await expect(page.locator(`section[data-shelf="${key}"]`)).toHaveCount(0);
		}
		// 再点取消 → 恢复全部 + URL 参数移除
		await frontendChip.click();
		await expect(frontendChip).toHaveAttribute("aria-pressed", "false");
		await expect(page.locator(".compass-tile")).toHaveCount(ENTRY_COUNT);
		await expect(page).not.toHaveURL(/group=/);
	});

	test("深链恢复筛选（?group=tools）与未知分组空态", async ({ page }) => {
		await page.goto("/compass/?group=tools");
		await expect(
			page.getByRole("button", { name: "工具", exact: true }),
		).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator(".compass-tile")).toHaveCount(5);
		await expect(page.locator(".compass-tile__label").first()).toHaveText(
			"飞书云文档",
		);
		// 未知分组值 → 空态文案
		await page.goto("/compass/?group=nonsense");
		await expect(page.locator(".compass-section__empty")).toBeVisible();
		await expect(page.locator(".compass-section__empty")).toContainText(
			"没有符合条件的站点",
		);
	});

	test("搜索过滤（label / 域名命中，?q= 同步，清空恢复）", async ({ page }) => {
		// 站内顶栏搜索框同名 placeholder，限定罗盘页内搜索框
		const search = page.locator(
			'.compass-section__search input[type="search"]',
		);
		// 域名片段命中阿里巴巴矢量图标库
		await search.fill("iconfont.cn");
		await expect(page).toHaveURL(/[?&]q=iconfont.cn/);
		await expect(page.locator(".compass-tile")).toHaveCount(1);
		await expect(page.locator(".compass-tile__label")).toHaveText(
			"阿里巴巴矢量图标库",
		);
		// 清空恢复全部 + URL 参数移除
		await search.fill("");
		await expect(page.locator(".compass-tile")).toHaveCount(ENTRY_COUNT);
		await expect(page).not.toHaveURL(/q=/);
		// note 命中（双因素验证码工具 → 2FA 验证码）
		await search.fill("双因素");
		await expect(page.locator(".compass-tile")).toHaveCount(1);
		await expect(page.locator(".compass-tile__label")).toHaveText("2FA 验证码");
	});

	test("空组隐藏：搜索只命中某组时其余分组不渲染", async ({ page }) => {
		await page
			.locator('.compass-section__search input[type="search"]')
			.fill("双因素");
		await expect(page.locator('section[data-shelf="tools"]')).toBeVisible();
		for (const key of SHELF_KEYS.filter((key) => key !== "tools")) {
			await expect(page.locator(`section[data-shelf="${key}"]`)).toHaveCount(0);
		}
	});

	test("无结果空态", async ({ page }) => {
		await page
			.locator('.compass-section__search input[type="search"]')
			.fill("zzzzzz");
		await expect(page.locator(".compass-tile")).toHaveCount(0);
		await expect(page.locator(".compass-section__empty")).toBeVisible();
		await expect(page.locator(".compass-section__empty")).toContainText(
			"没有符合条件的站点",
		);
	});

	test("侧栏 widget 在罗盘页照常渲染（pages 过滤对齐 friends/moments/anime）", async ({
		page,
	}) => {
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
