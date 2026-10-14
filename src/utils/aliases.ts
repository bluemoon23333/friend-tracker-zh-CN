// 别名字段工具：兼容 Obsidian 的 aliases 约定
// 支持 YAML 数组（Obsidian 默认写法）和用逗号、顿号、换行分隔的字符串

export function parseAliases(value: unknown): string[] {
	if (value === null || value === undefined) return [];

	const items = Array.isArray(value) ? value : String(value).split(/[,，、\n]+/);

	return items
		.map((item) => String(item).trim())
		.filter((item) => item.length > 0);
}

// 生成界面展示用的别名文本，如「小明、明明」
export function formatAliases(value: unknown): string {
	return parseAliases(value).join("、");
}
