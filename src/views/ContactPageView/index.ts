import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	TFile,
	setIcon,
	parseYaml,
	MarkdownRenderer,
} from "obsidian";
import type FriendTracker from "@/main";
import { ContactFields, createBirthdayInput } from "@/components/ContactFields";
import { InteractionView } from "@/components/InteractionView";
import { MentionsView } from "@/components/MentionsView";
import type { Interaction } from "@/types";
import { AddFieldModal } from "@/modals/AddFieldModal";
import { InteractionModal } from "@/modals/InteractionModal";
import { VIEW_TYPE_FRIEND_TRACKER } from "@/views/FriendTrackerView";
import { FriendTrackerView } from "@/views/FriendTrackerView";
import { STANDARD_FIELDS, SYSTEM_FIELDS, getFieldLabel } from "@/constants";
import { formatBirthdayText, parseBirthday } from "@/utils/birthday";
import { formatAliases, parseAliases } from "@/utils/aliases";

export const VIEW_TYPE_CONTACT_PAGE = "contact-page-view";

export class ContactPageView extends ItemView {
	private _file: TFile | null = null;
	private contactData: any = {};
	private contactFields: ContactFields;
	private interactionView: InteractionView;
	private mentionsView: MentionsView;
	public plugin: FriendTracker;
	private activeTab: "notes" | "interactions" | "markdown";

	public getRelationshipTypes(): string[] {
		return this.plugin.settings.relationshipTypes;
	}

	public async addRelationshipType(
		type: string,
		existingTypes?: string[]
	): Promise<void> {
		this.plugin.settings.relationshipTypes = [
			...(existingTypes || this.plugin.settings.relationshipTypes),
			type,
		];
		await this.plugin.saveSettings();
	}

	constructor(leaf: WorkspaceLeaf, private _plugin: FriendTracker) {
		super(leaf);
		this.plugin = _plugin;
		this.contactFields = new ContactFields(this);
		this.interactionView = new InteractionView(this);
		this.mentionsView = new MentionsView(this);
		this.activeTab = this.plugin.settings.defaultActiveTab;
	}

	getViewType(): string {
		return VIEW_TYPE_CONTACT_PAGE;
	}

	getDisplayText(): string {
		return this._file?.basename || "联系人";
	}

	get file() {
		return this._file;
	}

	async setState(state: any, result: any) {
		const file = this.app.vault.getFileByPath(state.filePath);
		if (file) {
			await this.setFile(file);
		}
		await super.setState(state, result);
	}

	getState() {
		return {
			type: VIEW_TYPE_CONTACT_PAGE,
			filePath: this._file?.path,
		};
	}

	async setFile(file: TFile) {
		this._file = file;
		const currentFilePath = file.path;
		try {
			const content = await this.app.vault.read(file);
			// Only update if this._file is still the same file
			if (this._file?.path !== currentFilePath) return;
			const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
			this.contactData = yamlMatch ? parseYaml(yamlMatch[1]) : {};
		} catch (error) {
			console.error(`读取联系人文件出错：${file.path}`, error);
			this.contactData = {};
		}
		// Only render if still the same file
		if (this._file?.path === currentFilePath) {
			this.render();
		}
	}

	render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		if (!this.contactData || !this.contactData.name) {
			container.createEl("div", {
				text: "暂无联系人数据",
				cls: "contact-empty-state",
			});
			return;
		}

		// Header with name
		const header = container.createEl("div", {
			cls: "contact-page-header",
		});
		const nameContainer = header.createEl("div", {
			cls: "contact-name-container",
		});
		this.renderNameSection(nameContainer);

		// Info section (always visible)
		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});
		this.renderInfoSection(infoSection);

		// Tabs container
		const tabsContainer = container.createEl("div", {
			cls: "contact-tabs",
		});

		const tabs = [
			{ id: "notes" as const, icon: "pencil", label: "笔记" },
			{
				id: "interactions" as const,
				icon: "clock",
				label: "互动记录",
			},
			{
				id: "markdown" as const,
				icon: "document",
				label: "Markdown",
			},
		];

		tabs.forEach((tab) => {
			const tabButton = tabsContainer.createEl("button", {
				cls: `contact-tab ${this.activeTab === tab.id ? "active" : ""}`,
			});

			setIcon(tabButton, tab.icon);
			tabButton.createSpan({ text: tab.label });

			tabButton.addEventListener("click", async () => {
				this.activeTab = tab.id;
				this.plugin.settings.defaultActiveTab = tab.id;
				await this.plugin.saveSettings();
				this.render();
			});
		});

		// Content container for tab content
		const contentContainer = container.createEl("div", {
			cls: "contact-content",
		});

		// Render content based on active tab
		switch (this.activeTab) {
			case "notes":
				this.renderNotesSection(contentContainer);
				break;
			case "interactions":
				this.renderInteractionsSection(contentContainer);
				break;
			case "markdown":
				this.renderExtrasSection(contentContainer);
				break;
		}
	}

	private renderNameSection(container: HTMLElement) {
		const nameSection = container.createEl("div", {
			cls: "contact-name-section",
		});

		const nameDisplay = nameSection.createEl("div", {
			cls: "contact-name-display",
		});

		const editContainer = nameDisplay.createEl("div", {
			cls: "contact-name-row",
		});

		const nameText = editContainer.createEl("h1", {
			text: this.contactData.name || "未命名联系人",
		});

		const nameInput = editContainer.createEl("input", {
			type: "text",
			value: this.contactData.name || "",
			placeholder: "联系人姓名",
			cls: "contact-name-input",
		});

		const editButton = editContainer.createEl("button", {
			cls: "friend-tracker-button button-icon contact-name-edit",
		});
		setIcon(editButton, "pencil");

		// Add age display if birthday exists
		const parsedBirthday = parseBirthday(this.contactData.birthday);
		if (parsedBirthday) {
			const birthYear = parsedBirthday.year;
			const birthMonth = parsedBirthday.month;
			const birthDay = parsedBirthday.day;

			// 只有知道出生年份时才显示年龄
			if (birthYear) {
				const ageText =
					this.plugin.contactOperations.calculateDetailedAge(
						this.contactData.birthday
					);
				if (ageText) {
					nameDisplay.createEl("span", {
						text: ageText,
						cls: "contact-age-display",
					});
				}
			}

			// Add zodiac displays
			const animals = [
				"鼠",
				"牛",
				"虎",
				"兔",
				"龙",
				"蛇",
				"马",
				"羊",
				"猴",
				"鸡",
				"狗",
				"猪",
			];
			const westernZodiac = this.getZodiacSign(birthMonth, birthDay);
			const season = this.getSeason(birthMonth, birthDay);
			const birthstone = this.getBirthstone(birthMonth);

			if (birthYear) {
				const chineseZodiac =
					animals[(((birthYear - 4) % 12) + 12) % 12];
				nameDisplay.createEl("span", {
					text: `${westernZodiac} · 属${chineseZodiac}`,
					cls: "contact-age-display",
				});
			} else {
				nameDisplay.createEl("span", {
					text: `${westernZodiac} · 出生年份未知`,
					cls: "contact-age-display",
				});
			}

			nameDisplay.createEl("span", {
				text: `${season}出生 · 诞生石：${birthstone}`,
				cls: "contact-age-display",
			});

			const daysUntil = this.calculateDaysUntilBirthday(
				this.contactData.birthday
			);
			if (daysUntil !== null) {
				const countdownContainer = nameDisplay.createEl("div", {
					cls: "contact-birthday-countdown",
				});

				if (daysUntil === 0) {
					// Birthday today - show cake
					countdownContainer.createEl("div", {
						cls: "table-birthday-indicator birthday-today",
						text: "🎂",
					});
					countdownContainer.createSpan({
						text: "今天生日！",
					});
				} else {
					// Show dot if within a week
					if (daysUntil <= 7) {
						const dotContainer = countdownContainer.createEl(
							"div",
							{
								cls: "birthday-status-dot",
							}
						);
						dotContainer.createEl("div", {
							cls: "birthday-status-dot-inner",
						});
					}

					const daysText =
						daysUntil === 1
							? "明天生日！"
							: `距离生日还有 ${daysUntil} 天`;

					countdownContainer.createSpan({
						text: daysText,
					});
				}
			}
		}

		editButton.addEventListener("click", () => {
			if (!nameInput.classList.contains("editing")) {
				nameText.classList.add("editing");
				nameInput.classList.add("editing");
				setIcon(editButton, "checkmark");
				nameInput.focus();
			} else {
				saveNameChange();
			}
		});

		const saveNameChange = async () => {
			if (!this._file) return;
			const newName = nameInput.value.trim();
			if (newName) {
				this.contactData.name = nameInput.value;
				await this.saveContactData();

				// Rename the file
				if (this._file.parent) {
					const newPath = `${this._file.parent.path}/${newName}.md`;
					try {
						await this.app.fileManager.renameFile(
							this._file,
							newPath
						);
						new Notice(`已更新联系人姓名`);

						// Refresh Friend Tracker view
						const friendTrackerLeaves =
							this.app.workspace.getLeavesOfType(
								VIEW_TYPE_FRIEND_TRACKER
							);
						for (const leaf of friendTrackerLeaves) {
							const view = await leaf.view;
							if (view instanceof FriendTrackerView) {
								await view.refresh();
								break;
							}
						}
					} catch (error) {
						new Notice(`更新文件名出错：${error}`);
					}
				}
			}
			nameText.textContent = nameInput.value || "未命名联系人";
			nameText.classList.remove("editing");
			nameInput.classList.remove("editing");
			setIcon(editButton, "pencil");
		};

		nameInput.addEventListener("change", saveNameChange);
	}

	private calculateDetailedAge(birthday: string): string {
		const birthDate = new Date(birthday + "T00:00:00Z");
		const today = new Date();

		// Reset times to midnight UTC to ensure consistent date comparison
		const todayUTC = new Date(
			Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
		);

		let years = todayUTC.getUTCFullYear() - birthDate.getUTCFullYear();
		let months = todayUTC.getUTCMonth() - birthDate.getUTCMonth();
		let days = todayUTC.getUTCDate() - birthDate.getUTCDate();

		// Adjust for negative days
		if (days < 0) {
			months--;
			// Get last day of previous month
			const lastMonth = new Date(
				Date.UTC(todayUTC.getFullYear(), todayUTC.getMonth(), 0)
			);
			days += lastMonth.getUTCDate();
		}

		// Adjust for negative months
		if (months < 0) {
			years--;
			months += 12;
		}

		// Format the output
		if (days === 0) {
			return `${years} 岁 ${months} 个月`;
		}
		return `${years} 岁 ${months} 个月 ${days} 天`;
	}

	private calculateDaysUntilBirthday(birthday: string): number | null {
		return this.plugin.contactOperations.calculateDaysUntilBirthday(
			birthday
		);
	}

	private getZodiacSign(month: number, day: number): string {
		if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
			return "白羊座";
		if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
			return "金牛座";
		if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
			return "双子座";
		if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
			return "巨蟹座";
		if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
			return "狮子座";
		if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
			return "处女座";
		if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
			return "天秤座";
		if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
			return "天蝎座";
		if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
			return "射手座";
		if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
			return "摩羯座";
		if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
			return "水瓶座";
		return "双鱼座";
	}

	private getSeason(month: number, day: number): string {
		// Northern hemisphere seasons
		if (
			(month === 3 && day >= 20) ||
			month === 4 ||
			month === 5 ||
			(month === 6 && day < 21)
		)
			return "春季";
		if (
			(month === 6 && day >= 21) ||
			month === 7 ||
			month === 8 ||
			(month === 9 && day < 22)
		)
			return "夏季";
		if (
			(month === 9 && day >= 22) ||
			month === 10 ||
			month === 11 ||
			(month === 12 && day < 21)
		)
			return "秋季";
		return "冬季";
	}

	private getBirthstone(month: number): string {
		const stones: Record<number, string> = {
			1: "石榴石",
			2: "紫水晶",
			3: "海蓝宝石",
			4: "钻石",
			5: "祖母绿",
			6: "珍珠",
			7: "红宝石",
			8: "橄榄石",
			9: "蓝宝石",
			10: "欧泊",
			11: "托帕石",
			12: "绿松石",
		};
		return stones[month] || "未知";
	}

	private renderInfoSection(container: HTMLElement) {
		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});

		const fieldsContainer = infoSection.createEl("div", {
			cls: "contact-fields-container",
		});

		const renderViewMode = () => {
			fieldsContainer.empty();
			fieldsContainer.classList.remove("editing");

			// Render each field as read-only text
			Object.entries(this.contactData)
				.filter(
					([key]) =>
						![
							"name",
							"notes",
							"interactions",
							"created",
							"updated",
						].includes(key)
				)
				.forEach(([key, value]) => {
					if (!value) return; // Skip empty values
					if (
						key === "aliases" &&
						Array.isArray(value) &&
						value.length === 0
					) {
						return;
					}

					const field = fieldsContainer.createEl("div", {
						cls: "contact-field-view",
						attr: {
							"data-field": key.toLowerCase(),
						},
					});

					field.createEl("div", {
						cls: "contact-field-label",
						text: getFieldLabel(key),
					});

					// 生日与别名做特殊展示
					const displayValue =
						key === "birthday" && value
							? formatBirthdayText(value)
							: key === "aliases"
							? formatAliases(value)
							: value;

					field.createEl("div", {
						cls: "contact-field-value",
						text: displayValue as string,
					});
				});

			// Add edit button at the bottom
			const editButton = fieldsContainer.createEl("button", {
				cls: "friend-tracker-button",
				text: "编辑",
			});

			editButton.addEventListener("click", () => {
				renderEditMode();
			});
		};

		const renderEditMode = () => {
			fieldsContainer.empty();
			fieldsContainer.classList.add("editing");

			// Standard fields first
			Object.values(STANDARD_FIELDS)
				.filter((field) => !SYSTEM_FIELDS.includes(field))
				.forEach((field) => {
					this.createInfoField(
						fieldsContainer,
						field,
						this.contactData[field]
					);
				});

			// Then custom fields
			const excludedFields = [
				...SYSTEM_FIELDS,
				...Object.values(STANDARD_FIELDS).map((f) => f.toLowerCase()),
				"created",
				"updated",
			];
			Object.entries(this.contactData)
				.filter(([key]) => !excludedFields.includes(key.toLowerCase()))
				.forEach(([key, value]) => {
					this.createInfoField(fieldsContainer, key, value as string);
				});

			// Add custom field button
			const addFieldButton = fieldsContainer.createEl("button", {
				cls: "friend-tracker-button button-outlined",
				text: "添加自定义字段",
			});
			addFieldButton.addEventListener("click", () => {
				this.openAddFieldModal();
			});

			// Add done button
			const doneButton = fieldsContainer.createEl("button", {
				cls: "friend-tracker-button button-primary button-full-width",
				text: "完成",
			});

			doneButton.addEventListener("click", async () => {
				await this.saveContactData();
				renderViewMode();
			});
		};

		// Initial render in view mode
		renderViewMode();
	}

	private createInfoField(
		container: HTMLElement,
		field: string,
		value: string
	) {
		const fieldContainer = container.createEl("div", {
			cls: "contact-field",
		});

		fieldContainer.createEl("label", {
			text: getFieldLabel(field),
		});

		if (field === "aliases") {
			const aliasInput = fieldContainer.createEl("input", {
				cls: "contact-field-input",
				attr: {
					type: "text",
					placeholder: "别名，多个用逗号分隔",
					value: formatAliases(value),
				},
			});
			aliasInput.addEventListener("change", () => {
				const aliases = parseAliases(aliasInput.value);
				this.updateContactData(
					field,
					aliases.length > 0 ? aliases : ""
				);
			});
			return;
		}

		if (field === "birthday") {
			createBirthdayInput(fieldContainer, value, (newValue) => {
				this.updateContactData(field, newValue);
			});
			return;
		}

		const input = fieldContainer.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "text",
				placeholder: `输入${getFieldLabel(field)}`,
				value: value || "",
				...(field === "relationship" && {
					list: "relationship-types",
				}),
			},
		});

		input.addEventListener("change", () => {
			this.updateContactData(field, input.value);
		});
	}

	private renderNotesSection(container: HTMLElement) {
		const notesSection = container.createEl("div", {
			cls: "contact-notes-section",
		});

		const notesInput = notesSection.createEl("textarea", {
			cls: "contact-notes-input",
			attr: {
				placeholder:
					"记录家人信息、父母姓名，或任何你想记住的内容……",
			},
		});
		notesInput.value = this.contactData.notes || "";

		notesInput.addEventListener("input", () => {
			this.adjustTextareaHeight(notesInput);
		});

		setTimeout(() => {
			this.adjustTextareaHeight(notesInput);
		}, 0);

		notesInput.addEventListener("change", async () => {
			if (!this._file) return;
			this.contactData.notes = notesInput.value;
			await this.saveContactData();
		});
	}

	private renderInteractionsSection(container: HTMLElement) {
		if (this.plugin.settings.interactionMode === "mentions") {
			const name = this.contactData.name || this._file?.basename || "";
			const aliases = parseAliases(this.contactData.aliases);
			void this.mentionsView.render(container, [name, ...aliases]);
			return;
		}
		const interactions = container.createEl("div", {
			cls: "contact-interactions",
		});

		const headerContainer = interactions.createEl("div", {
			cls: "contact-interactions-header",
		});

		// Add helper text if no interactions
		if (
			!Array.isArray(this.contactData.interactions) ||
			this.contactData.interactions.length === 0
		) {
			headerContainer.createEl("div", {
				cls: "section-helper-text",
				text: "记录重要的联系时刻，例如见面、通话或重要交谈，帮助你维系良好的人际关系",
			});
		}

		const addButton = headerContainer.createEl("button", {
			cls: "friend-tracker-button button-align-right",
			text: "添加互动记录",
		});
		addButton.addEventListener("click", () => {
			this.openAddInteractionModal();
		});

		if (Array.isArray(this.contactData.interactions)) {
			this.interactionView.render(
				interactions,
				this.contactData.interactions
			);
		}
	}

	private async renderExtrasSection(container: HTMLElement) {
		const extrasSection = container.createEl("div", {
			cls: "contact-extras-section",
		});

		if (!this._file) return;

		const headerContainer = extrasSection.createEl("div", {
			cls: "contact-extras-header",
		});

		// Add helper text if no markdown content
		const content = await this.app.vault.read(this._file);
		const extrasContent =
			content.split(/^---\n([\s\S]*?)\n---/).pop() || "";

		if (!extrasContent.trim()) {
			headerContainer.createEl("div", {
				cls: "section-helper-text",
				text: "添加格式化文本、链接和其他 Markdown 内容",
			});
		}

		const editButton = headerContainer.createEl("button", {
			cls: "friend-tracker-button button-align-right",
			text: "编辑 Markdown",
		});

		editButton.addEventListener("click", () => {
			this.app.workspace.openLinkText(this._file?.path || "", "", true);
		});

		try {
			const content = await this.app.vault.read(this._file);
			const extrasContent =
				content.split(/^---\n([\s\S]*?)\n---/).pop() || "";

			if (extrasContent.trim()) {
				const contentDiv = extrasSection.createEl("div", {
					cls: "contact-extras-content",
				});

				await MarkdownRenderer.renderMarkdown(
					extrasContent,
					contentDiv,
					this._file.path,
					this
				);

				// Add click handlers for internal links
				contentDiv.addEventListener("click", (event) => {
					const target = event.target as HTMLElement;
					if (target.tagName === "A") {
						const anchor = target as HTMLAnchorElement;
						const href = anchor.getAttribute("href");

						if (href?.startsWith("#")) {
							// Handle internal anchor links
							event.preventDefault();
							const targetEl = contentDiv.querySelector(href);
							targetEl?.scrollIntoView();
						} else if (!href?.startsWith("http")) {
							// Handle internal Obsidian links
							event.preventDefault();
							this.app.workspace.openLinkText(
								href || "",
								this._file?.path || "",
								event.ctrlKey || event.metaKey
							);
						}
					}
				});
			}
		} catch (error) {
			console.error(
				`读取附加内容出错：${this._file.path}`,
				error
			);
		}
	}

	private adjustTextareaHeight(textarea: HTMLTextAreaElement) {
		textarea.classList.add("measuring");
		textarea.style.setProperty(
			"--scroll-height",
			`${textarea.scrollHeight}px`
		);
		textarea.classList.remove("measuring");
	}

	async saveContactData() {
		if (!this._file) return;

		// Sort interactions by date in descending order (newest first)
		if (this.contactData.interactions) {
			this.contactData.interactions.sort(
				(a: Interaction, b: Interaction) =>
					new Date(b.date).getTime() - new Date(a.date).getTime()
			);
		}

		await this.app.fileManager.processFrontMatter(
			this._file,
			(frontmatter) => {
				Object.assign(frontmatter, this.contactData);
			}
		);
	}

	// Modal methods
	private async openAddFieldModal() {
		const modal = new AddFieldModal(this.app, async (fieldName) => {
			if (!this.contactData[fieldName]) {
				this.contactData[fieldName] = "";
				await this.saveContactData();
				this.render();
			} else {
				new Notice("该字段已存在！");
			}
		});
		modal.open();
	}

	private async openAddInteractionModal() {
		const modal = new InteractionModal(
			this.app,
			null,
			async (date: string, text: string) => {
				if (!Array.isArray(this.contactData.interactions)) {
					this.contactData.interactions = [];
				}
				this.contactData.interactions.push({ date, text });
				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	public async openEditInteractionModal(
		index: number,
		interaction: Interaction
	) {
		const modal = new InteractionModal(
			this.app,
			interaction,
			async (date: string, text: string) => {
				if (!Array.isArray(this.contactData.interactions)) {
					this.contactData.interactions = [];
				}
				this.contactData.interactions[index] = { date, text };
				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	public async deleteInteraction(index: number) {
		this.contactData.interactions.splice(index, 1);
		await this.saveContactData();
		this.render();
	}

	async updateContactData(field: string, value: string | string[]) {
		this.contactData[field] = value;
		await this.saveContactData();
	}
}
