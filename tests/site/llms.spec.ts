import { expect, test } from "@playwright/test";

test.describe("LLMs.txt & AI-friendly Content Endpoints", () => {
	test("GET /llms.txt returns the 56 imported public articles", async ({
		page,
	}) => {
		const response = await page.goto("/llms.txt");
		expect(response).not.toBeNull();
		expect(response?.status()).toBe(200);

		const contentType = response?.headers()["content-type"] || "";
		expect(contentType).toContain("text/markdown");

		const text = await response?.text();
		expect(text).toBeDefined();

		// 验证基本元数据与核心章节
		expect(text).toContain("# HikariTish");
		expect(text).toContain("## Core Pages");
		expect(text).toContain("- [Home](");
		expect(text).toContain("- [About](");
		expect(text).toContain("- [Archive](");

		// 验证公开文章目录索引
		expect(text).toContain("## Articles");
		expect(text).toContain("/posts/docker/docker常用命令/");
		expect(text).toContain("/posts/ai-workstation/ai安装/");
		expect(text?.match(/\/posts\//g)).toHaveLength(56);

		// 验证全量正文链接
		expect(text).toContain("## Full Text Dump");
		expect(text).toContain("/llms-full.txt");

		// 排除目录不会进入公开索引。
		expect(text).not.toContain("资产平台管理");
		expect(text).not.toContain("/posts/eino/");
	});

	test("GET /llms-full.txt concatenates imported articles with redacted credentials", async ({
		page,
	}) => {
		const response = await page.goto("/llms-full.txt");
		expect(response).not.toBeNull();
		expect(response?.status()).toBe(200);

		const contentType = response?.headers()["content-type"] || "";
		expect(contentType).toContain("text/markdown");

		const text = await response?.text();
		expect(text).toBeDefined();

		// 验证全量正文头部
		expect(text).toContain("# HikariTish - Full Content Archive");

		// 验证公开文章包含完整正文内容
		expect(text).toContain("## Docker常用命令");
		expect(text).toContain("# Docker 常用命令");
		expect(text).toContain("## AI安装");
		expect(text).toContain("REDACTED_SECRET");

		// 导入副本中不能残留常见真实凭据形态。
		expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
		expect(text).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
		expect(text).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/);
		expect(text).not.toContain("资产平台管理");
		expect(text).not.toContain("## 组件ChatModel");
	});
});
