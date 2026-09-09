const providerSecretPatterns = [
	/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
	/ghp_[A-Za-z0-9]{20,}/g,
	/github_pat_[A-Za-z0-9_]{20,}/g,
	/AKIA[A-Z0-9]{16}/g,
	/LTAI[A-Za-z0-9]{12,}/g,
	/AIza[0-9A-Za-z_-]{20,}/g,
	/xox[baprs]-[A-Za-z0-9-]{10,}/g,
];
const assignedSecretPattern =
	/((?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*)(["'])([^"']{12,})\2/gi;

export function sanitizeSecrets(source) {
	let content = source;
	let redactionCount = 0;

	content = content.replace(assignedSecretPattern, (_match, prefix, quote) => {
		redactionCount += 1;
		return `${prefix}${quote}REDACTED_SECRET${quote}`;
	});

	for (const pattern of providerSecretPatterns) {
		content = content.replace(pattern, () => {
			redactionCount += 1;
			return "REDACTED_SECRET";
		});
	}

	return { content, redactionCount };
}

export function resolvePostDescriptionResult(
	data,
	title,
	curatedDescription = "",
) {
	const customDescription = String(data.description ?? "").trim();
	const curatedFallback = String(curatedDescription).trim();
	const description =
		customDescription || curatedFallback || `关于「${title}」的技术笔记。`;
	return sanitizeSecrets(description);
}

export function resolvePostDescription(data, title, curatedDescription = "") {
	return resolvePostDescriptionResult(data, title, curatedDescription).content;
}
