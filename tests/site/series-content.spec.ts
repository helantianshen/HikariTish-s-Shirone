import { expect, test } from "@playwright/test";

const seriesCases = [
	{
		slug: "viper",
		title: "Viper 学习记录",
		count: 9,
		first: "01-single-values",
		second: "02-decode-and-validate",
		last: "09-safe-hot-reload",
	},
	{
		slug: "rust",
		title: "Rust 学习笔记",
		count: 12,
		first: "smart-pointers-1",
		second: "smart-pointers-2",
		last: "initialization-1",
	},
];

// 使用本站系列校验排序、首尾导航和 Swup 切页，避免依赖主题演示文章
for (const series of seriesCases) {
	test(`${series.title}保留目录及相邻章节导航`, async ({ page }) => {
		await page.goto(`/series/${series.slug}/`);
		const links = page.locator(".series-detail__row");
		await expect(links).toHaveCount(series.count);
		await expect(links.first()).toHaveAttribute(
			"href",
			`/posts/${series.slug}/${series.first}/`,
		);
		await expect(links.last()).toHaveAttribute(
			"href",
			`/posts/${series.slug}/${series.last}/`,
		);

		await page.waitForFunction(() => Boolean(window.swup));
		await links.first().click();
		const card = page.locator("[data-series-card]");
		await expect(card).toHaveAttribute("data-series-slug", series.slug);
		await expect(card.locator(".series-card__row--prev")).toHaveCount(0);
		const next = card.locator(".series-card__row--next");
		await expect(next).toHaveAttribute(
			"href",
			`/posts/${series.slug}/${series.second}/`,
		);
		await next.click();
		await expect(page).toHaveURL(`/posts/${series.slug}/${series.second}/`);
		await expect(card.locator(".series-card__row--prev")).toHaveAttribute(
			"href",
			`/posts/${series.slug}/${series.first}/`,
		);
		await page.goto(`/posts/${series.slug}/${series.last}/`);
		await expect(card.locator(".series-card__row--next")).toHaveCount(0);
		await expect(card.locator(".series-card__row--prev")).toHaveCount(1);
	});
}
