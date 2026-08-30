import { expect, test } from "@playwright/test";
import { skillsData } from "../../src/data/skills.ts";

const SKILL_COUNT = 21;
const FRONTEND_RUNTIME_COUNT = 3;

const EXPECTED_LEVELS = {
	expert: ["Go", "Java"],
	advanced: ["Rust", "Python", "MySQL", "Redis", "Nginx", "Docker", "RabbitMQ"],
	intermediate: [
		"C++",
		"C",
		"Vue",
		"Node.js",
		"Kotlin",
		"PostgreSQL",
		"Elasticsearch",
		"Kubernetes (K8s)",
		"JavaScript",
		"TypeScript",
	],
	beginner: ["Verilog", "React"],
} as const;

test.describe("技能页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/skills/");
		await expect(page.locator(".skill-card")).toHaveCount(SKILL_COUNT);
	});

	test("技能数据与用户给出的熟练度完全一致", () => {
		expect(skillsData).toHaveLength(SKILL_COUNT);
		for (const [level, names] of Object.entries(EXPECTED_LEVELS)) {
			expect(
				skillsData
					.filter((skill) => skill.level === level)
					.map((skill) => skill.name),
			).toEqual(names);
		}
	});

	test("渲染配置技能与离散熟练度", async ({ page }) => {
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"skills",
		);
		await expect(page.locator(".page-header__title")).toHaveText("技能");
		await expect(page.locator(".skills-section__count")).toHaveText(
			"21 项技能",
		);

		const go = page.locator(".skill-card", { hasText: "Go" });
		await expect(go).toContainText("精通");
		await expect(go.getByRole("meter")).toHaveAttribute("aria-valuenow", "4");
		await expect(go.locator(".skill-card__segment--active")).toHaveCount(4);
		await expect(page.locator(".skill-card svg")).toHaveCount(SKILL_COUNT);
	});

	test("分类 chips 可筛选并再次点击恢复全部", async ({ page }) => {
		const frontend = page.getByRole("button", {
			name: "前端与运行时",
			exact: true,
		});
		await frontend.click();
		await expect(frontend).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator(".skill-card")).toHaveCount(
			FRONTEND_RUNTIME_COUNT,
		);

		await frontend.click();
		await expect(frontend).toHaveAttribute("aria-pressed", "false");
		await expect(page.locator(".skill-card")).toHaveCount(SKILL_COUNT);
	});

	test("侧栏页面过滤与直接加载导航高亮正确", async ({ page }) => {
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
		await expect(
			page.locator('[data-nav-key="skills"]').first(),
		).toHaveAttribute("aria-current", "page");
	});
});

test.describe("技能页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("从持久顶栏进入后同步页面、导航与侧栏状态", async ({ page }) => {
		await page.goto("/compass/", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "更多", exact: true }).click();
		await page.locator('a[data-nav-key="skills"]').click();

		await expect(page).toHaveURL(/\/skills\/$/);
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"skills",
		);
		await expect(page.locator(".skill-card")).toHaveCount(SKILL_COUNT);
		await expect(page.locator('a[data-nav-key="skills"]')).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
