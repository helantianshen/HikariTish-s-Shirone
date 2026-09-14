import { expect, test } from "@playwright/test";

test("关于页渲染站点介绍正文", async ({ page }) => {
	await page.goto("/about/");
	await expect(page.locator("#swup-container")).toHaveAttribute(
		"data-current-page",
		"about",
	);
	const markdown = page.locator(".markdown-content");
	await expect(markdown).toHaveCount(1);
	await expect(markdown).toContainText("关于这个博客");
	await expect(markdown).toContainText("Go 与后端开发");
	await expect(markdown).toContainText("保持开放");
	await expect(markdown).toContainText("申请友情链接");
	await expect(markdown).toContainText("helanlordts@163.com");
	await expect(markdown).toContainText("站点头像");
	await expect(markdown.locator("h1, h2, h3")).toHaveCount(5);
	await expect(markdown.locator('a[href="/archive/"]')).toHaveCount(1);
	await expect(markdown.locator('a[href="/friends/"]')).toHaveCount(1);
});
