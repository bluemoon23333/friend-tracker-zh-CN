// 日期工具：用于「最近互动」的推算与展示

// 从日记类文件名中解析日期，如 2026-10-14、2026.10.14、2026年10月14日、20261014
export function parseDateFromName(name: string): number | null {
	if (!name) return null;

	let match = name.match(/^(\d{4})[-–—._/年](\d{1,2})[-–—._/月](\d{1,2})/);
	if (!match) {
		match = name.match(/^(\d{4})(\d{2})(\d{2})/);
	}
	if (!match) return null;

	return toLocalMidnight(
		Number(match[1]),
		Number(match[2]),
		Number(match[3])
	);
}

// 把 YYYY-MM-DD 之类的日期字符串解析成本地零点时间戳
export function parseDateToLocalMidnight(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;

	// YAML 可能把日期解析为 Date 对象
	if (value instanceof Date) {
		if (isNaN(value.getTime())) return null;
		return toLocalMidnight(
			value.getUTCFullYear(),
			value.getUTCMonth() + 1,
			value.getUTCDate()
		);
	}

	const raw = String(value).trim().split(/[T\s]/)[0];
	const match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
	if (!match) return null;

	return toLocalMidnight(
		Number(match[1]),
		Number(match[2]),
		Number(match[3])
	);
}

function toLocalMidnight(
	year: number,
	month: number,
	day: number
): number | null {
	if (!Number.isInteger(year) || year < 1000) return null;
	if (!Number.isInteger(month) || month < 1 || month > 12) return null;
	if (!Number.isInteger(day) || day < 1 || day > 31) return null;

	const date = new Date(year, month - 1, day);
	date.setHours(0, 0, 0, 0);

	if (isNaN(date.getTime())) return null;
	return date.getTime();
}

// 显示成「今天」「X 天前」
export function formatDaysAgo(time: number): string {
	const target = new Date(time);
	const today = new Date();

	const targetDay = Date.UTC(
		target.getFullYear(),
		target.getMonth(),
		target.getDate()
	);
	const todayDay = Date.UTC(
		today.getFullYear(),
		today.getMonth(),
		today.getDate()
	);

	const diffDays = Math.round(
		(todayDay - targetDay) / (1000 * 60 * 60 * 24)
	);

	if (diffDays <= 0) return "今天";
	return `${diffDays} 天前`;
}
