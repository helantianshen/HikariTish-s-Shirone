import { expect, test } from "@playwright/test";

const PROJECT_COUNT = 8;
const PROJECT_KEYS = [
	"gantry",
	"oss-sync",
	"cmp",
	"mcpp",
	"fish-breeding-manager",
	"jianjia-nexus-website",
	"novagate",
	"novanexus",
];

test.describe("项目页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/projects/");
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
	});

	test("按指定顺序渲染项目、阶段、技术栈与源码链接", async ({ page }) => {
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"projects",
		);
		await expect(page.locator(".page-header__title")).toHaveText("项目");
		await expect(page.locator(".projects-section__count")).toHaveText(
			"8 个项目",
		);

		const projectOrder = await page
			.locator(".project-card")
			.evaluateAll((cards) =>
				cards.map((card) => card.getAttribute("data-project")),
			);
		expect(projectOrder).toEqual(PROJECT_KEYS);

		const gantry = page.locator('[data-project="gantry"]');
		await expect(gantry.locator("h2")).toHaveText("Gantry");
		await expect(gantry.locator(".project-card__cover img")).toHaveAttribute(
			"src",
			"/assets/projects/gantry.webp",
		);
		await expect(gantry).toHaveClass(/project-card--featured/);
		await expect(gantry.locator('[data-phase="building"]')).toHaveText(
			"构建中",
		);
		await expect(gantry.locator(".project-card__technologies li")).toHaveCount(
			6,
		);
		await expect(
			gantry.getByRole("link", { name: "查看源码" }),
		).toHaveAttribute("href", "https://github.com/helantianshen/gantry");

		const ossSync = page.locator('[data-project="oss-sync"]');
		await expect(ossSync.locator('[data-phase="shipped"]')).toHaveText(
			"已发布",
		);

		const cmp = page.locator('[data-project="cmp"]');
		await expect(cmp.locator(".project-card__icon")).toBeVisible();
		await expect(cmp.locator('[data-phase="building"]')).toHaveText("构建中");
		await expect(cmp.getByRole("link", { name: "查看源码" })).toHaveAttribute(
			"href",
			"https://github.com/mcpplibs/cmp",
		);

		const jianjia = page.locator('[data-project="jianjia-nexus-website"]');
		await expect(jianjia.locator(".project-card__cover img")).toHaveAttribute(
			"src",
			"/assets/projects/jianjia-nexus-website.webp",
		);
		await expect(jianjia.locator('[data-phase="shipped"]')).toHaveText(
			"已发布",
		);
		await expect(
			jianjia.getByRole("link", { name: "查看源码" }),
		).toHaveAttribute(
			"href",
			"https://github.com/helantianshen/JianJiaNexus-OfficialWebsite-Frontend",
		);

		const fishBreedingManager = page.locator(
			'[data-project="fish-breeding-manager"]',
		);
		await expect(
			fishBreedingManager.locator(".project-card__cover img"),
		).toHaveAttribute("src", "/assets/projects/fish-breeding-manager.webp");
	});

	test("无封面项目卡片都渲染可见图标", async ({ page }) => {
		await expect(page.locator(".project-card__icon svg")).toHaveCount(
			PROJECT_COUNT - 3,
		);
	});

	test("直接加载时导航高亮与侧栏页面过滤正确", async ({ page }) => {
		await expect(
			page.locator('[data-nav-key="projects"]').first(),
		).toHaveAttribute("aria-current", "page");
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});

	test("分类筛选会同步项目数量与可见卡片（含 LoadingIndicator 过渡）", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "C++ 生态", exact: true }).click();
		await expect(
			page.locator(".projects-section__loading .m3-loading--contained"),
		).toBeVisible();
		await expect(page.locator(".project-card")).toHaveCount(2);
		await expect(page.locator(".projects-section__count")).toHaveText(
			"2 个项目",
		);
		await expect(page.locator('[data-project="gantry"]')).toHaveCount(0);
		await expect(page.locator('[data-project="cmp"]')).toBeVisible();
		await expect(page.locator('[data-project="mcpp"]')).toBeVisible();
		await expect(page.locator(".projects-section__loading")).toHaveCount(0);

		await page.getByRole("button", { name: "C++ 生态", exact: true }).click();
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
	});

	test("实时搜索过滤与清除（URL ?q= 同步）", async ({ page }) => {
		const searchInput = page.locator(".projects-section__search input");
		await expect(searchInput).toBeVisible();
		await searchInput.fill("Gantry");
		await expect(page.locator(".project-card")).toHaveCount(1);
		await expect(page.locator('[data-project="gantry"]')).toBeVisible();
		await expect(page).toHaveURL(/[?&]q=Gantry/);

		const clearBtn = page.locator(".projects-section__search-clear");
		await clearBtn.click();
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
		await expect(page).not.toHaveURL(/q=/);
	});

	test("桌面与手机布局之间无刷新切换时重置瀑布流定位", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		const grid = page.locator(".projects-section__grid");
		const cards = page.locator(".project-card");

		await expect
			.poll(() =>
				grid.evaluate(
					(element) =>
						getComputedStyle(element)
							.gridTemplateColumns.split(" ")
							.filter(Boolean).length,
				),
			)
			.toBeGreaterThan(1);
		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) =>
							(element as HTMLElement).style.gridColumnStart !== "" &&
							(element as HTMLElement).style.gridRowEnd !== "",
					),
				),
			)
			.toBe(true);
		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) => getComputedStyle(element).gridColumnEnd === "span 1",
					),
				),
			)
			.toBe(true);

		await page.setViewportSize({ width: 390, height: 844 });

		await expect
			.poll(() =>
				grid.evaluate(
					(element) =>
						getComputedStyle(element)
							.gridTemplateColumns.split(" ")
							.filter(Boolean).length,
				),
			)
			.toBe(1);
		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) =>
							(element as HTMLElement).style.gridColumnStart === "" &&
							(element as HTMLElement).style.gridRowEnd === "",
					),
				),
			)
			.toBe(true);
		await expect(cards).toHaveCount(PROJECT_COUNT);
		await expect(page).toHaveURL(/\/projects\/$/);

		await page.setViewportSize({ width: 1280, height: 900 });

		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) =>
							(element as HTMLElement).style.gridColumnStart !== "" &&
							(element as HTMLElement).style.gridRowEnd !== "",
					),
				),
			)
			.toBe(true);
	});

	test("无封面卡片在桌面端将技术栈与源码操作合并为同一行", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		const cards = page.locator(".project-card--without-cover");

		await expect(cards).toHaveCount(PROJECT_COUNT - 3);

		const rowsMerged = await cards.evaluateAll((elements) =>
			elements.every((element) => {
				const card = element as HTMLElement;
				const technologies = card.querySelector<HTMLElement>(
					".project-card__technologies",
				);
				const actions = card.querySelector<HTMLElement>(
					".project-card__actions",
				);
				if (!technologies || !actions) return false;
				const techBox = technologies.getBoundingClientRect();
				const actionsBox = actions.getBoundingClientRect();
				return (
					techBox.top < actionsBox.bottom && actionsBox.top < techBox.bottom
				);
			}),
		);

		await expect(rowsMerged).toBe(true);
	});
});

test.describe("项目页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("从持久顶栏进入后同步页面、导航与侧栏状态", async ({ page }) => {
		await page.goto("/skills/", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "更多", exact: true }).click();
		await page.locator('a[data-nav-key="projects"]').click();

		await expect(page).toHaveURL(/\/projects\/$/);
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"projects",
		);
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
		await expect(page.locator('a[data-nav-key="projects"]')).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
