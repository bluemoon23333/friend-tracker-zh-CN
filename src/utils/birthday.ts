// 生日解析与格式化工具
// 支持「只知道月份和日期、不知道出生年份」的生日写法

export interface ParsedBirthday {
	year: number | null;
	month: number;
	day: number;
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// 解析生日字符串，支持以下写法：
// - 1995-08-16、1995/8/16、1995.8.16（完整生日）
// - 08-16、8/16（只有月日，不知道出生年份）
// - --08-16（无年份的常见写法）
// - 19950816、0816（数字连写）
// - YAML 解析出的 Date 对象
export function parseBirthday(value: unknown): ParsedBirthday | null {
	if (value === null || value === undefined || value === "") return null;

	// YAML 可能把日期解析为 Date 对象
	if (value instanceof Date) {
		if (isNaN(value.getTime())) return null;
		return {
			year: value.getUTCFullYear(),
			month: value.getUTCMonth() + 1,
			day: value.getUTCDate(),
		};
	}

	// 去掉可能带有的时间部分，如 2000-05-20T00:00:00.000Z
	let raw = String(value).trim();
	if (!raw) return null;
	raw = raw.split(/[T\s]/)[0].replace(/[./]/g, "-");

	const parts = raw.split("-").filter((part) => part.length > 0);
	let year: number | null = null;
	let monthText: string;
	let dayText: string;

	if (parts.length === 3) {
		year = Number(parts[0]);
		monthText = parts[1];
		dayText = parts[2];
	} else if (parts.length === 2) {
		monthText = parts[0];
		dayText = parts[1];
	} else if (parts.length === 1 && /^\d{8}$/.test(parts[0])) {
		year = Number(parts[0].slice(0, 4));
		monthText = parts[0].slice(4, 6);
		dayText = parts[0].slice(6, 8);
	} else if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
		monthText = parts[0].slice(0, 2);
		dayText = parts[0].slice(2, 4);
	} else {
		return null;
	}

	const month = Number(monthText);
	const day = Number(dayText);

	if (!Number.isInteger(month) || month < 1 || month > 12) return null;
	if (!Number.isInteger(day) || day < 1) return null;
	if (day > DAYS_IN_MONTH[month - 1]) return null;

	// 年份过小时按「年份未知」处理（例如 95-08-16）
	if (year !== null && (!Number.isInteger(year) || year < 1000)) {
		year = null;
	}

	return { year, month, day };
}

// 把年、月、日组合成存储用的字符串
export function toBirthdayString(
	year: number | null,
	month: number,
	day: number
): string {
	const mm = month < 10 ? `0${month}` : String(month);
	const dd = day < 10 ? `0${day}` : String(day);
	return year ? `${year}-${mm}-${dd}` : `${mm}-${dd}`;
}

// 生成界面展示用的生日文本，如「2000年5月20日」「5月20日」
export function formatBirthdayText(value: unknown): string {
	const parsed = parseBirthday(value);
	if (!parsed) return typeof value === "string" ? value : "";
	return parsed.year
		? `${parsed.year}年${parsed.month}月${parsed.day}日`
		: `${parsed.month}月${parsed.day}日`;
}
