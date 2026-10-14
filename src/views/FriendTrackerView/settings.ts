import {
	App,
	PluginSettingTab,
	Setting,
	AbstractInputSuggest,
	TFolder,
	normalizePath,
} from "obsidian";
import type FriendTracker from "@/main";
import type {
	ContactWithCountdown,
	InteractionMode,
	MentionSearchScope,
} from "@/types";
import {
	ContactPageView,
	VIEW_TYPE_CONTACT_PAGE,
} from "@/views/ContactPageView";

class FolderSuggest extends AbstractInputSuggest<string> {
	inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): string[] {
		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f) => f instanceof TFolder)
			.map((f) => f.path);
		return folders.filter((f) =>
			f.toLowerCase().includes(inputStr.toLowerCase())
		);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.inputEl.value = value;
		this.inputEl.trigger("input");
		this.close();
	}
}

export class FriendTrackerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: FriendTracker) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const sortColumns: Array<{
			value: keyof Omit<ContactWithCountdown, "file">;
			label: string;
		}> = [
			{ value: "name", label: "姓名" },
			{ value: "age", label: "年龄" },
			{ value: "birthday", label: "生日" },
			{ value: "daysUntilBirthday", label: "距离生日天数" },
			{ value: "relationship", label: "关系" },
			{ value: "lastInteraction", label: "最近互动" },
		];

		new Setting(containerEl)
			.setName("联系人文件夹")
			.setDesc("用于存放联系人文件的文件夹")
			.addText((text) => {
				new FolderSuggest(this.app, text.inputEl);
				return text
					.setPlaceholder("输入文件夹名称")
					.setValue(this.plugin.settings.contactsFolder)
					.onChange(async (value) => {
						this.plugin.settings.contactsFolder =
							normalizePath(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("默认排序")
			.setDesc("选择联系人的默认排序方式")
			.addDropdown((dropdown) => {
				sortColumns.forEach(({ value, label }) => {
					dropdown.addOption(value, label);
				});
				return dropdown
					.setValue(this.plugin.settings.defaultSortColumn)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortColumn =
							value as keyof Omit<ContactWithCountdown, "file">;
						await this.plugin.saveSettings();
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("asc", "升序")
					.addOption("desc", "降序")
					.setValue(this.plugin.settings.defaultSortDirection)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortDirection = value as
							| "asc"
							| "desc";
						await this.plugin.saveSettings();
					});
			});

		const headerContainer = containerEl.createEl("div", {
			cls: "friend-tracker-relationship-header",
		});

		headerContainer.createEl("h3", { text: "关系类型" });

		new Setting(headerContainer).addButton((button) =>
			button.setButtonText("添加关系类型").onClick(async () => {
				// Create a temporary input field
				const tempInput = document.createElement("input");
				tempInput.type = "text";
				tempInput.placeholder = "输入关系类型";
				tempInput.className =
					"friend-tracker-modal-input relationship-type-input";

				// Replace button with input temporarily
				button.buttonEl.replaceWith(tempInput);
				tempInput.focus();

				const handleAdd = async () => {
					const fullValue = tempInput.value || "";
					const value = fullValue.trim();

					if (value) {
						const newType = value.toLowerCase();
						if (
							!this.plugin.settings.relationshipTypes.includes(
								newType
							)
						) {
							this.plugin.settings.relationshipTypes.push(
								newType
							);
							await this.plugin.saveSettings();
						}
					}
					// Schedule the display update after the current event
					setTimeout(() => this.display(), 0);
				};

				tempInput.addEventListener("keydown", async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await handleAdd();
					} else if (e.key === "Escape") {
						this.display();
					}
				});

				// Only handle blur if there's a value
				tempInput.addEventListener("blur", async () => {
					if (tempInput.value?.trim()) {
						await handleAdd();
					} else {
						this.display();
					}
				});
			})
		);

		const relationshipContainer = containerEl.createEl("div", {
			cls: "friend-tracker-relationship-types",
		});

		this.plugin.settings.relationshipTypes.forEach((type) => {
			new Setting(relationshipContainer)
				.addText((text) =>
					text
						.setValue(type)
						.setPlaceholder("类型名称")
						.then((textComponent) => {
							// Save on Enter
							textComponent.inputEl.addEventListener(
								"keypress",
								async (e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										textComponent.inputEl.blur();
									}
								}
							);

							// Save on blur
							textComponent.inputEl.addEventListener(
								"blur",
								async () => {
									const value = textComponent.inputEl.value;
									const index =
										this.plugin.settings.relationshipTypes.indexOf(
											type
										);
									if (
										value.toLowerCase() !== type ||
										value !== value.toLowerCase()
									) {
										const newType = value.toLowerCase();
										this.plugin.settings.relationshipTypes =
											[
												...this.plugin.settings.relationshipTypes.filter(
													(t, i) =>
														i === index ||
														t.toLowerCase() !==
															newType
												),
											];
										this.plugin.settings.relationshipTypes[
											index
										] = newType;
										await this.plugin.saveSettings();
										// Schedule the display update after the current event
										setTimeout(() => this.display(), 0);
									}
								}
							);
						})
				)
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("删除关系类型")
						.onClick(async () => {
							const index =
								this.plugin.settings.relationshipTypes.indexOf(
									type
								);
							this.plugin.settings.relationshipTypes.splice(
								index,
								1
							);
							await this.plugin.saveSettings();
							this.display();
						});
				});
		});

		new Setting(containerEl)
			.setName("默认标签页")
			.setDesc("选择联系人页面默认打开的标签页")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("notes", "笔记")
					.addOption("interactions", "互动记录")
					.addOption("markdown", "Markdown")
					.setValue(this.plugin.settings.defaultActiveTab)
					.onChange(
						async (
							value: "notes" | "interactions" | "markdown"
						) => {
							this.plugin.settings.defaultActiveTab = value;
							await this.plugin.saveSettings();
						}
					);
			});
		new Setting(containerEl)
			.setName("互动记录模式")
			.setDesc("选择联系人页面「互动记录」标签页的展示方式，切换后已打开的联系人页面会立即刷新；「提及记录」模式下，主列表的「最近互动」会按库中的提及推算")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("manual", "手动记录（默认）")
					.addOption(
						"mentions",
						"提及记录（显示库中提及该联系人的内容）"
					)
					.setValue(this.plugin.settings.interactionMode)
					.onChange(async (value) => {
						this.plugin.settings.interactionMode =
							value as InteractionMode;
						await this.plugin.saveSettings();
						this.refreshContactViews();
					});
			});

		new Setting(containerEl)
			.setName("提及搜索范围")
			.setDesc("「提及记录」模式的搜索范围：搜索整个库，或只搜索指定文件夹")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("vault", "整个库")
					.addOption("folder", "指定文件夹")
					.setValue(this.plugin.settings.mentionsSearchScope)
					.onChange(async (value) => {
						this.plugin.settings.mentionsSearchScope =
							value as MentionSearchScope;
						await this.plugin.saveSettings();
						this.refreshContactViews();
						this.display();
					});
			});

		if (this.plugin.settings.mentionsSearchScope === "folder") {
			new Setting(containerEl)
				.setName("提及搜索文件夹")
				.setDesc("只搜索该文件夹及其子文件夹中提到该联系人的内容")
				.addText((text) => {
					new FolderSuggest(this.app, text.inputEl);
					text.inputEl.addEventListener("blur", () => {
						this.refreshContactViews();
					});
					return text
						.setPlaceholder("如：日记")
						.setValue(this.plugin.settings.mentionsFolder)
						.onChange(async (value) => {
							this.plugin.settings.mentionsFolder =
								normalizePath(value);
							await this.plugin.saveSettings();
						});
				});
		}

	}

	private refreshContactViews() {
		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_CONTACT_PAGE)
			.forEach((leaf) => {
				const view = leaf.view;
				if (view instanceof ContactPageView) {
					view.render();
				}
			});
	}
}
