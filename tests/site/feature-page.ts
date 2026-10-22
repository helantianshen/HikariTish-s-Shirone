import { expect, test } from "@playwright/test";

/**
 * 功能页通过持久顶栏进行 Swup 导航后，校验页面内容、导航高亮和侧栏过滤状态
 */

export interface PersistentShellSyncCase {
	/** Nav `pageKey`, also written to `data-current-page`. */
	key: string;
	/** Page the test starts on, to make the click a real Swup navigation. */
	fromPath: string;
	/** Path asserted after the click, e.g. `/games/`. */
	toPath: RegExp;
	/** Card class for this feature, e.g. `game-card`. */
	cardSelector: string;
	/** Expected number of cards after arriving. */
	cardCount: number;
}

/** 功能页应显示分类和标签侧栏组件 */
const EXPECTED_WIDGETS = ["categories", "tags"];

/** 注册功能页导航后的内容与持久壳同步检查 */
export function registerPersistentShellSync(
	title: string,
	testCase: PersistentShellSyncCase,
): void {
	test(title, async ({ page }) => {
		await page.goto(testCase.fromPath, { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "更多", exact: true }).click();
		await page.locator(`a[data-nav-key="${testCase.key}"]`).click();

		await expect(page).toHaveURL(testCase.toPath);
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			testCase.key,
		);
		await expect(page.locator(`.${testCase.cardSelector}`)).toHaveCount(
			testCase.cardCount,
		);
		await expect(
			page.locator(`a[data-nav-key="${testCase.key}"]`),
		).toHaveAttribute("aria-current", "page");
		for (const widget of EXPECTED_WIDGETS) {
			await expect(
				page.locator(`widget-layout[data-id="${widget}"]`),
			).toBeVisible();
		}
	});
}
