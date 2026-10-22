import { expect, test } from "@playwright/test";
import { registerPersistentShellSync } from "./feature-page";

test.describe("时间线页空内容", () => {
	test("保留页面与空状态，不渲染示例节点或分类筛选", async ({ page }) => {
		await page.goto("/timeline/");
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"timeline",
		);
		await expect(page.locator(".page-header__title")).toHaveText("时间线");
		await expect(page.locator(".timeline-card")).toHaveCount(0);
		await expect(page.locator(".timeline-section__tools")).toHaveCount(0);
		await expect(page.locator(".timeline-section__empty")).toContainText(
			"没有符合该分类的节点",
		);
	});
});

test.describe("时间线页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });
	registerPersistentShellSync("从持久顶栏进入后保留空内容并同步导航与侧栏", {
		key: "timeline",
		fromPath: "/skills/",
		toPath: /\/timeline\/$/,
		cardSelector: "timeline-card",
		cardCount: 0,
	});
});
