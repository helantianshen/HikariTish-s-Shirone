import { expect, test } from "@playwright/test";

test.describe("导入的 Obsidian 文章", () => {
	test("公开技术文章和 AI 工作站文章均可直接访问", async ({ page }) => {
		await page.goto("/posts/docker/docker常用命令/", {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator('[data-pagefind-meta="title"]')).toContainText(
			"Docker常用命令",
		);
		await expect(page.locator(".markdown-content")).toContainText(
			"Docker 常用命令",
		);
		await expect(page.locator("#post-cover img")).toBeVisible();

		await page.goto("/7/", { waitUntil: "domcontentloaded" });
		const dockerCard = page
			.locator(".m3-blog-postcard")
			.filter({ hasText: "Docker常用命令" });
		await expect(
			dockerCard.locator(".m3-blog-postcard__cover img"),
		).toBeVisible();

		await page.goto("/posts/ai-workstation/ai安装/", {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator('[data-pagefind-meta="title"]')).toContainText(
			"AI安装",
		);
		await expect(page.locator(".markdown-content")).toContainText("Pi Agent");
		await expect(page.locator(".protected-post")).toHaveCount(0);
	});

	test("Go GMP 与 Context 文章在详情页和列表卡片展示本地封面", async ({
		page,
	}) => {
		await page.goto("/posts/go/go-gmp-调度算法/", {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator("#post-cover img")).toBeVisible();

		await page.goto("/7/", { waitUntil: "domcontentloaded" });
		const gmpCard = page
			.locator(".m3-blog-postcard")
			.filter({ hasText: "Go GMP 调度算法" });
		await expect(gmpCard.locator(".m3-blog-postcard__cover img")).toBeVisible();

		await page.goto("/posts/go/go-context-底层原理/", {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator("#post-cover img")).toBeVisible();

		await page.goto("/3/", { waitUntil: "domcontentloaded" });
		const contextCard = page
			.locator(".m3-blog-postcard")
			.filter({ hasText: "Go Context 底层原理" });
		await expect(
			contextCard.locator(".m3-blog-postcard__cover img"),
		).toBeVisible();
	});

	test("文章详情与标签索引使用整理后的标签体系", async ({ page }) => {
		await page.goto("/posts/go/go-gmp-调度算法/", {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator(".m3-blog-postmeta__tags")).toHaveText(
			"go/并发/底层原理",
		);

		await page.goto("/tags/", { waitUntil: "domcontentloaded" });
		const chips = page.locator(".tag-index__chip");
		await expect(chips).toHaveCount(28);
		for (const [tag, count] of [
			["go", "13"],
			["gin", "12"],
			["docker", "2"],
			["分布式", "2"],
			["主从模式", "1"],
		] as const) {
			const chip = page.locator(
				`.tag-index__chip[aria-label="View all posts with the ${tag} tag"]`,
			);
			await expect(chip).toHaveCount(1);
			await expect(chip.locator(".tag-index__count")).toHaveText(count);
		}
	});
});
