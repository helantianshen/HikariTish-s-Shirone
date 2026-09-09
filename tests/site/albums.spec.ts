import { expect, test } from "@playwright/test";

test.describe("相册页空内容", () => {
	test("保留相册索引与空状态，不渲染示例相册", async ({ page }) => {
		await page.goto("/albums/");
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"albums",
		);
		await expect(page.locator(".page-header__title")).toHaveText("相册");
		await expect(page.locator(".album-card")).toHaveCount(0);
		await expect(page.locator(".album-section__tools")).toHaveCount(0);
		await expect(page.locator(".album-section__empty")).toContainText(
			"没有符合条件的相册",
		);
	});

	test("原有示例相册详情路由不再生成", async ({ page }) => {
		for (const id of [
			"AcgExample",
			"EncryptedExample",
			"ExternalExample",
			"HiddenExample",
		]) {
			const response = await page.goto(`/albums/${id}/`);
			expect(response?.status()).toBe(404);
		}
	});
});
