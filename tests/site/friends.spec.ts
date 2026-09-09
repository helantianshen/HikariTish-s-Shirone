import { expect, test } from "@playwright/test";

const FRIEND_COUNT = 6;

test.describe("友链页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/friends/");
		await expect(page.locator(".friend-card")).toHaveCount(FRIEND_COUNT);
	});

	test("仅渲染新的六个博客友链与本地图标", async ({ page }) => {
		const cards = page.locator(".friend-card");
		await expect(cards.first()).toHaveAttribute(
			"href",
			"https://blog.hikarilan.life/?ref=www.perass.com",
		);
		await expect(cards.first()).toContainText("HikariLan's Blog");
		await expect(cards.last()).toHaveAttribute("href", "https://tx1st.cn/");
		await expect(cards.last()).toContainText("天行1st的博客");
		await expect(page.locator(".friend-card img")).toHaveCount(FRIEND_COUNT);
		for (const src of await page
			.locator(".friend-card img")
			.evaluateAll((images) =>
				images.map((image) => image.getAttribute("src")),
			)) {
			expect(src).toMatch(/^\/assets\/friends\//);
		}
		await expect(page.locator(".friend-section__count")).toHaveText("6 个友链");
	});

	test("搜索与标签筛选继续可用", async ({ page }) => {
		const search = page.locator(".friend-section__search input");
		await search.fill("KubeSphere");
		await expect(page.locator(".friend-card")).toHaveCount(1);
		await expect(page.locator(".friend-card")).toContainText("天行1st的博客");
		expect(new URL(page.url()).searchParams.get("q")).toBe("KubeSphere");

		await search.fill("");
		const openSource = page.getByRole("button", { name: "开源", exact: true });
		await openSource.click();
		await expect(openSource).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator(".friend-card")).toHaveCount(1);
		await expect(page.locator(".friend-card")).toContainText(
			"言峰 Sunrisepeak",
		);
		expect(new URL(page.url()).searchParams.get("tag")).toBe("开源");
	});

	test("无匹配结果时显示中文空状态", async ({ page }) => {
		await page.locator(".friend-section__search input").fill("no such site");
		await expect(page.locator(".friend-card")).toHaveCount(0);
		await expect(page.locator(".friend-section__empty")).toContainText(
			"没有符合条件的友链",
		);
	});
});
