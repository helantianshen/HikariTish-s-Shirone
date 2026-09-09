import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const dataPath = join(projectRoot, "src", "data", "compass.ts");
const outputDirectory = join(projectRoot, "public", "assets", "compass");
const reportPath = join(
	projectRoot,
	".agent",
	"runtime",
	"compass-icon-report.json",
);
const refresh = process.argv.includes("--refresh");

const brandIcons = new Map([
	["Forge 文档", "minecraft"],
	["GoClub", "go"],
	["LeetCode", "leetcode"],
	["Rust 文档", "rust"],
	["Cloudflare 主页", "cloudflare"],
	["海外 VPS 主机", "hostinger"],
	["EdgeOne 控制台", "tencentcloud"],
	["阿里巴巴矢量图标库", "alibabacloud"],
	["Anime.js", "animejs"],
	["NutUI", "jd"],
	["DevUI", "huawei"],
	["Ant Design", "antdesign"],
	["PrimeVue", "primevue"],
	["Element Plus", "element"],
	["GSAP", "greensock"],
	["蒸汽游戏宝库", "steam"],
	["Google Gemini", "googlegemini"],
	["Google AI Studio", "google"],
	["ChatGPT", "openai"],
	["千问", "alibabacloud"],
	["DeepSeek 开放平台", "deepseek"],
	["飞书云文档", "feishu"],
	["Gmail", "gmail"],
]);

function parseEntries(source) {
	const entries = [];
	let currentLabel = "";
	for (const line of source.split(/\r?\n/)) {
		const label = line.match(/^\s*label:\s*"([^"]+)"/);
		if (label) currentLabel = label[1];
		const href = line.match(/^\s*href:\s*"([^"]+)"/);
		if (href && currentLabel) {
			entries.push({ label: currentLabel, href: href[1] });
			currentLabel = "";
		}
	}
	return entries;
}

function fileNameFor(entry) {
	const url = new URL(entry.href);
	const host = url.hostname
		.replace(/^www\./, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
	const hash = createHash("sha256")
		.update(entry.href)
		.digest("hex")
		.slice(0, 8);
	return `${host || "site"}-${hash}.png`;
}

function attributesOf(tag) {
	const attributes = new Map();
	for (const match of tag.matchAll(
		/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
	)) {
		attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
	}
	return attributes;
}

function faviconLinks(html, baseUrl) {
	const candidates = [];
	for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
		const attributes = attributesOf(match[0]);
		const rel = attributes.get("rel")?.toLowerCase() ?? "";
		const href = attributes.get("href");
		if (!href || !rel.includes("icon")) continue;
		try {
			candidates.push(new URL(href, baseUrl).href);
		} catch {
			// Ignore malformed icon declarations and continue with conventional paths.
		}
	}
	return candidates;
}

async function fetchWithTimeout(url, accept) {
	return fetch(url, {
		headers: {
			accept,
			"user-agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
		},
		redirect: "follow",
		signal: AbortSignal.timeout(8_000),
	});
}

async function rasterizeRemoteIcon(url) {
	const response = await fetchWithTimeout(
		url,
		"image/avif,image/webp,image/*,*/*;q=0.8",
	);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const declaredLength = Number(response.headers.get("content-length") ?? 0);
	if (declaredLength > 1_048_576) throw new Error("icon exceeds 1 MiB");
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length < 24 || buffer.length > 1_048_576)
		throw new Error("invalid icon size");
	return sharp(buffer, { animated: false, failOn: "error" })
		.resize(96, 96, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
			withoutEnlargement: true,
		})
		.png()
		.toBuffer();
}

async function directCandidates(entry) {
	const pageUrl = new URL(entry.href);
	pageUrl.hash = "";
	const candidates = [];
	try {
		const response = await fetchWithTimeout(
			pageUrl.href,
			"text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
		);
		if (response.ok) {
			const contentType = response.headers.get("content-type") ?? "";
			if (contentType.includes("text/html")) {
				const html = (await response.text()).slice(0, 1_048_576);
				candidates.push(...faviconLinks(html, response.url));
			}
		}
	} catch {
		// The conventional favicon paths below may still be reachable.
	}
	candidates.push(
		new URL("/favicon.ico", pageUrl.origin).href,
		new URL("/favicon.png", pageUrl.origin).href,
	);
	return [...new Set(candidates)];
}

async function simpleIcon(entry) {
	const name = brandIcons.get(entry.label);
	if (!name) return null;
	const iconSetPath = join(
		projectRoot,
		"node_modules",
		"@iconify-json",
		"simple-icons",
		"icons.json",
	);
	const source = JSON.parse(await readFile(iconSetPath, "utf8"));
	let icon = source.icons?.[name];
	let width = icon?.width ?? source.width ?? 24;
	let height = icon?.height ?? source.height ?? 24;
	if (!icon && source.aliases?.[name]) {
		const alias = source.aliases[name];
		icon = source.icons?.[alias.parent];
		width = alias.width ?? icon?.width ?? source.width ?? 24;
		height = alias.height ?? icon?.height ?? source.height ?? 24;
	}
	if (!icon) return null;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" color="#675075">${icon.body}</svg>`;
	return sharp(Buffer.from(svg))
		.resize(96, 96, { fit: "contain" })
		.png()
		.toBuffer();
}

async function cacheEntry(entry) {
	const fileName = fileNameFor(entry);
	const outputPath = join(outputDirectory, fileName);
	if (!refresh && existsSync(outputPath)) {
		return { ...entry, image: `/assets/compass/${fileName}`, source: "cached" };
	}
	for (const candidate of await directCandidates(entry)) {
		try {
			const image = await rasterizeRemoteIcon(candidate);
			await writeFile(outputPath, image);
			return { ...entry, image: `/assets/compass/${fileName}`, source: "site" };
		} catch {
			// Try the next site-declared or conventional icon URL.
		}
	}
	const bundledBrand = await simpleIcon(entry);
	if (bundledBrand) {
		await writeFile(outputPath, bundledBrand);
		return { ...entry, image: `/assets/compass/${fileName}`, source: "brand" };
	}
	return { ...entry, image: null, source: "fallback" };
}

async function mapWithConcurrency(items, concurrency, worker) {
	const results = new Array(items.length);
	let next = 0;
	async function run() {
		while (next < items.length) {
			const index = next++;
			results[index] = await worker(items[index]);
		}
	}
	await Promise.all(Array.from({ length: concurrency }, run));
	return results;
}

await mkdir(outputDirectory, { recursive: true });
const entries = parseEntries(await readFile(dataPath, "utf8"));
const results = await mapWithConcurrency(entries, 6, cacheEntry);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

const counts = Object.groupBy(results, (result) => result.source);
for (const [source, items] of Object.entries(counts))
	console.log(`${source}: ${items.length}`);
console.log(`report: ${basename(dirname(reportPath))}/${basename(reportPath)}`);
