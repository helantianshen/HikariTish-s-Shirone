import { expect, test } from "@playwright/test";

test.describe("动态页空内容", () => {
	test("保留页面与空状态，不渲染示例动态或筛选工具", async ({ page }) => {
		await page.goto("/moments/");
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"moments",
		);
		await expect(page.locator(".page-header__title")).toHaveText("动态");
		await expect(page.locator(".moment-card")).toHaveCount(0);
		await expect(page.locator(".moment-section__tools")).toHaveCount(0);
		await expect(page.locator(".moment-section__empty")).toContainText(
			"没有符合条件的动态",
		);
	});
});
