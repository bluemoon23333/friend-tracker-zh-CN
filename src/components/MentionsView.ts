import { Menu, TFile, setIcon } from "obsidian";
import type { ContactPageView } from "@/views/ContactPageView";
import type { MentionSearchScope, MentionSortOrder } from "@/types";

interface MentionResult {
	file: TFile;
	line: number;
	text: string;
	// 该行实际匹配到的关键词（姓名或某个别名）
	matchedTerm: string;
}

const MAX_RESULTS = 300;

// 排序菜单分组：与 Obsidian 反向链接面板的排序选项保持一致
const SORT_GROUPS: Array<Array<{ id: MentionSortOrder; title: string }>> = [
	[
		{ id: "name-asc", title: "文件名（A-Z）" },
		{ id: "name-desc", title: "文件名（Z-A）" },
	],
	[
		{ id: "mtime-desc", title: "编辑时间（从新到旧）" },
		{ id: "mtime-asc", title: "编辑时间（从旧到新）" },
	],
	[
		{ id: "ctime-desc", title: "创建时间（从新到旧）" },
		{ id: "ctime-asc", title: "创建时间（从旧到新）" },
	],
];

// 「提及记录」模式：展示整个库（或指定文件夹）中提到该联系人姓名或别名的内容
// 相当于 Obsidian 反向链接面板中的「提及」部分
export class MentionsView {
	// 检索关键词：第一个是姓名，后面是别名
	private terms: string[] = [];
	private listContainer: HTMLElement | null = null;
	private results: MentionResult[] = [];

	constructor(private view: ContactPageView) {}

	async render(container: HTMLElement, terms: string[]) {
		this.terms = terms
			.map((term) => (term || "").trim())
			.filter((term) => term.length > 0);
		this.results = [];

		const mentions = container.createEl("div", {
			cls: "contact-interactions",
		});

		const headerContainer = mentions.createEl("div", {
			cls: "contact-interactions-header",
		});

		headerContainer.createEl("div", {
			cls: "section-helper-text",
			text: `「提及记录」模式：以下内容来自${this.getScopeLabel()}中提到该联系人姓名或别名的笔记（相当于反向链接面板中的「提及」）。可在 设置 → 好友追踪 → 互动记录模式 中切换。`,
		});

		const actions = headerContainer.createEl("div", {
			cls: "contact-mentions-actions",
		});

		const sortButton = actions.createEl("button", {
			cls: "friend-tracker-button",
			attr: { "aria-label": "排序方式" },
		});
		sortButton.createSpan({ text: "排序方式" });
		const chevron = sortButton.createSpan({
			cls: "friend-tracker-menu-chevron",
		});
		setIcon(chevron, "chevron-down");
		sortButton.addEventListener("click", (event) => {
			this.openSortMenu(event);
		});

		const refreshButton = actions.createEl("button", {
			cls: "friend-tracker-button button-align-right",
			text: "刷新",
		});
		refreshButton.addEventListener("click", () => {
			void this.reload();
		});

		this.listContainer = mentions.createEl("div", {
			cls: "contact-mentions-list",
		});

		await this.reload();
	}

	// 重新扫描并渲染
	private async reload() {
		const container = this.listContainer;
		if (!container) return;

		container.empty();

		const { scope, folder } = this.getScope();

		if (scope === "folder") {
			if (!folder) {
				container.createEl("div", {
					cls: "section-helper-text",
					text: "当前搜索范围为「指定文件夹」，但尚未选择文件夹。请在 设置 → 好友追踪 → 提及搜索文件夹 中选择。",
				});
				return;
			}
			if (!this.view.app.vault.getFolderByPath(folder)) {
				container.createEl("div", {
					cls: "section-helper-text",
					text: `未找到文件夹「${folder}」，请检查 设置 → 好友追踪 → 提及搜索文件夹。`,
				});
				return;
			}
		}

		container.createEl("div", {
			cls: "section-helper-text",
			text:
				scope === "folder"
					? `正在扫描文件夹「${folder}」中的提及…`
					: "正在扫描整个库中的提及…",
		});

		this.results = await this.collectMentions();

		this.renderResults();
	}

	// 只按当前排序方式重新渲染，不重新扫描
	private renderResults() {
		const container = this.listContainer;
		if (!container) return;

		container.empty();

		if (this.terms.length === 0) {
			container.createEl("div", {
				cls: "section-helper-text",
				text: "该联系人还没有姓名，无法搜索提及。",
			});
			return;
		}

		if (this.results.length === 0) {
			container.createEl("div", {
				cls: "section-helper-text",
				text: `未找到提到${this.getSearchLabel()}的内容。`,
			});
			return;
		}

		const sorted = this.sortResults(this.results);

		container.createEl("div", {
			cls: "section-helper-text",
			text: `共找到 ${sorted.length} 条提及`,
		});

		sorted.forEach((item) => {
			this.renderMentionItem(container, item);
		});
	}

	// 形如「张三」「小三」的关键词列表
	private getSearchLabel(): string {
		return this.terms.map((term) => `「${term}」`).join("、");
	}

	// 读取当前搜索范围设置
	private getScope(): { scope: MentionSearchScope; folder: string } {
		const settings = this.view.plugin.settings;
		const scope = settings.mentionsSearchScope || "vault";
		const folder = (settings.mentionsFolder || "")
			.trim()
			.replace(/^\/+|\/+$/g, "");

		return { scope, folder };
	}

	private getScopeLabel(): string {
		const { scope, folder } = this.getScope();
		if (scope === "folder") {
			return folder ? `文件夹「${folder}」` : "指定文件夹";
		}
		return "整个库";
	}

	private get sortOrder(): MentionSortOrder {
		return this.view.plugin.settings.mentionsSortOrder || "mtime-desc";
	}

	private openSortMenu(event: MouseEvent) {
		const menu = new Menu();
		const current = this.sortOrder;

		SORT_GROUPS.forEach((group, groupIndex) => {
			if (groupIndex > 0) menu.addSeparator();

			group.forEach((option) => {
				menu.addItem((item) => {
					item.setTitle(option.title);
					item.setChecked(current === option.id);
					item.onClick(() => {
						void this.setSortOrder(option.id);
					});
				});
			});
		});

		menu.showAtMouseEvent(event);
	}

	private async setSortOrder(order: MentionSortOrder) {
		this.view.plugin.settings.mentionsSortOrder = order;
		await this.view.plugin.saveSettings();
		this.renderResults();
	}

	private sortResults(results: MentionResult[]): MentionResult[] {
		const compareName = (a: MentionResult, b: MentionResult) =>
			a.file.basename.localeCompare(b.file.basename);

		const sorted = [...results];

		switch (this.sortOrder) {
			case "name-asc":
				sorted.sort(compareName);
				break;
			case "name-desc":
				sorted.sort((a, b) => compareName(b, a));
				break;
			case "mtime-asc":
				sorted.sort((a, b) => a.file.stat.mtime - b.file.stat.mtime);
				break;
			case "ctime-desc":
				sorted.sort((a, b) => b.file.stat.ctime - a.file.stat.ctime);
				break;
			case "ctime-asc":
				sorted.sort((a, b) => a.file.stat.ctime - b.file.stat.ctime);
				break;
			case "mtime-desc":
			default:
				sorted.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				break;
		}

		return sorted;
	}

	private async collectMentions(): Promise<MentionResult[]> {
		const results: MentionResult[] = [];
		if (this.terms.length === 0) return results;

		const { scope, folder } = this.getScope();
		const lowerTerms = this.terms.map((term) => term.toLowerCase());
		const currentPath = this.view.file?.path;
		const files = this.view.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (file.path === currentPath) continue;
			if (scope === "folder" && !file.path.startsWith(folder + "/")) {
				continue;
			}

			const content = await this.view.app.vault.cachedRead(file);
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

				const lowerLine = line.toLowerCase();
				const matchedIndex = lowerTerms.findIndex((term) =>
					lowerLine.includes(term)
				);
				if (matchedIndex === -1) continue;

				results.push({
					file,
					line: index + 1,
					text: line.trim(),
					matchedTerm: this.terms[matchedIndex],
				});

				if (results.length >= MAX_RESULTS) break;
			}

			if (results.length >= MAX_RESULTS) break;
		}

		return results;
	}

	private renderMentionItem(container: HTMLElement, item: MentionResult) {
		const itemEl = container.createEl("div", {
			cls: "contact-mention-item",
		});

		const sourceEl = itemEl.createEl("div", {
			cls: "contact-mention-source",
		});
		sourceEl.createSpan({ text: item.file.basename });
		sourceEl.createSpan({
			cls: "contact-mention-line",
			text: ` 第 ${item.line} 行`,
		});
		// 通过别名匹配时给出提示，方便辨认
		if (item.matchedTerm !== this.terms[0]) {
			sourceEl.createSpan({
				cls: "contact-mention-alias-tag",
				text: ` · 别名匹配：${item.matchedTerm}`,
			});
		}

		const textEl = itemEl.createEl("div", {
			cls: "contact-mention-text",
		});
		this.appendHighlightedText(textEl, item.text);

		itemEl.addEventListener("click", () => {
			void this.openMentionSource(item.file, item.line);
		});
	}

	// 高亮行内所有命中的关键词（姓名或别名）
	private appendHighlightedText(container: HTMLElement, text: string) {
		const lowerTerms = this.terms.map((term) => term.toLowerCase());

		if (lowerTerms.length === 0) {
			container.appendChild(document.createTextNode(text));
			return;
		}

		const lowerText = text.toLowerCase();
		let cursor = 0;

		while (cursor < text.length) {
			let matchIndex = -1;
			let matchLength = 0;

			lowerTerms.forEach((term) => {
				const index = lowerText.indexOf(term, cursor);
				if (index === -1) return;
				if (
					matchIndex === -1 ||
					index < matchIndex ||
					(index === matchIndex && term.length > matchLength)
				) {
					matchIndex = index;
					matchLength = term.length;
				}
			});

			if (matchIndex === -1) break;

			if (matchIndex > cursor) {
				container.appendChild(
					document.createTextNode(text.slice(cursor, matchIndex))
				);
			}

			container.createEl("mark", {
				text: text.slice(matchIndex, matchIndex + matchLength),
			});

			cursor = matchIndex + matchLength;
		}

		if (cursor < text.length) {
			container.appendChild(document.createTextNode(text.slice(cursor)));
		}
	}

	private async openMentionSource(file: TFile, line: number) {
		const leaf = this.view.app.workspace.getLeaf("tab");
		try {
			await leaf.openFile(file, {
				eState: { line: Math.max(0, line - 1) },
			});
		} catch {
			await leaf.openFile(file);
		}
		this.view.app.workspace.setActiveLeaf(leaf, { focus: true });
	}
}
