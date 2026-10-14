import type FriendTracker from "@/main";
import type { ContactWithCountdown, MentionSearchScope } from "@/types";
import { parseDateFromName } from "@/utils/dates";

export interface MentionSummary {
	// 最近一次提及所在笔记的时间戳：日记取文件名里的日期，其他笔记取修改时间
	time: number;
	// 来源笔记名
	source: string;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 提及索引：一次性扫描整个库（或指定文件夹），算出每个联系人最近一次被提及的信息
// 结果会被缓存，库内容变化时通过 invalidate() 标记失效
export class MentionIndex {
	private summaries = new Map<string, MentionSummary>();
	private cacheKey = "";
	private dirty = true;

	constructor(private plugin: FriendTracker) {}

	// 库内容变化时调用，下次获取时重建
	invalidate() {
		this.dirty = true;
	}

	async getSummaries(
		contacts: ContactWithCountdown[]
	): Promise<Map<string, MentionSummary>> {
		const { scope, folder } = this.getScope();
		const cacheKey = [
			scope,
			folder,
			contacts
				.map(
					(contact) =>
						`${contact.file.path}\u0000${contact.name}\u0000${contact.aliases.join(
							"\u0001"
						)}`
				)
				.join("\u0002"),
		].join("\u0003");

		if (!this.dirty && this.cacheKey === cacheKey) {
			return this.summaries;
		}

		this.summaries = await this.build(contacts, scope, folder);
		this.cacheKey = cacheKey;
		this.dirty = false;

		return this.summaries;
	}

	private getScope(): { scope: MentionSearchScope; folder: string } {
		const settings = this.plugin.settings;
		const scope = settings.mentionsSearchScope || "vault";
		const folder = (settings.mentionsFolder || "")
			.trim()
			.replace(/^\/+|\/+$/g, "");

		return { scope, folder };
	}

	private async build(
		contacts: ContactWithCountdown[],
		scope: MentionSearchScope,
		folder: string
	): Promise<Map<string, MentionSummary>> {
		const summaries = new Map<string, MentionSummary>();

		// 关键词（姓名与别名）→ 联系人文件路径
		const termMap = new Map<string, string[]>();
		for (const contact of contacts) {
			for (const term of [contact.name, ...contact.aliases]) {
				const key = (term || "").trim().toLowerCase();
				if (!key) continue;

				const paths = termMap.get(key);
				if (!paths) {
					termMap.set(key, [contact.file.path]);
				} else if (!paths.includes(contact.file.path)) {
					paths.push(contact.file.path);
				}
			}
		}

		if (termMap.size === 0) return summaries;

		// 长关键词排在前面，避免「小明」抢先匹配掉「小明哥」
		const pattern = new RegExp(
			Array.from(termMap.keys())
				.sort((a, b) => b.length - a.length)
				.map(escapeRegExp)
				.join("|"),
			"gi"
		);

		const contactPaths = new Set(contacts.map((c) => c.file.path));
		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (contactPaths.has(file.path)) continue;
			if (scope === "folder") {
				if (!folder) continue;
				if (!file.path.startsWith(folder + "/")) continue;
			}

			const content = await this.plugin.app.vault.cachedRead(file);
			const time = parseDateFromName(file.basename) ?? file.stat.mtime;
			const source = file.basename;

			const lines = content.split("\n");

			// check = 还没判断文件是否以 YAML 前置元数据开头
			let state: "check" | "frontmatter" | "body" = "check";
			let inCodeBlock = false;

			for (let index = 0; index < lines.length; index++) {
				const line = lines[index];

				if (state === "check") {
					state = line.trim() === "---" ? "frontmatter" : "body";
				}

				// 跳过 YAML 前置元数据
				if (state === "frontmatter") {
					if (index > 0 && line.trim() === "---") {
						state = "body";
					}
					continue;
				}

				// 跳过代码块
				if (line.trim().startsWith("```")) {
					inCodeBlock = !inCodeBlock;
					continue;
				}
				if (inCodeBlock) continue;

				const matchedTerms = new Set<string>();
				pattern.lastIndex = 0;
				let match = pattern.exec(line);
				while (match !== null) {
					matchedTerms.add(match[0].toLowerCase());
					if (pattern.lastIndex === match.index) {
						pattern.lastIndex++;
					}
					match = pattern.exec(line);
				}

				for (const term of matchedTerms) {
					const paths = termMap.get(term);
					if (!paths) continue;

					for (const path of paths) {
						const existing = summaries.get(path);
						if (!existing || time > existing.time) {
							summaries.set(path, { time, source });
						}
					}
				}
			}
		}

		return summaries;
	}
}
