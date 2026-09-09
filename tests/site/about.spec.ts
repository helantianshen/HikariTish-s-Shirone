import { expect, test } from "@playwright/test";

test("关于页保留页面结构但正文为空", async ({ page }) => {
	await page.goto("/about/");
	await expect(page.locator("#swup-container")).toHaveAttribute(
		"data-current-page",
		"about",
	);
	const markdown = page.locator(".markdown-content");
	await expect(markdown).toHaveCount(1);
	await expect(markdown).toHaveText("");
	await expect(markdown.locator("h1, h2, h3, p, ul, ol, a, img")).toHaveCount(
		0,
	);
});
