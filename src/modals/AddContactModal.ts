import { App, Modal, Notice } from "obsidian";
import type FriendTracker from "@/main";
import { stringifyYaml } from "obsidian";
import { VIEW_TYPE_FRIEND_TRACKER } from "@/views/FriendTrackerView";
import { FriendTrackerView } from "@/views/FriendTrackerView";
import { createBirthdayInput, createRelationshipInput } from "@/components/ContactFields";
import { parseAliases } from "@/utils/aliases";

export class AddContactModal extends Modal {
	constructor(app: App, private plugin: FriendTracker) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "添加新联系人" });

		const form = contentEl.createEl("form", {
			cls: "friend-tracker-add-contact-form",
		});

		// Name field (required)
		const nameField = form.createDiv({ cls: "friend-tracker-modal-field" });
		nameField.createEl("label", { text: "姓名 *" });
		const nameInput = nameField.createEl("input", {
			attr: {
				type: "text",
				name: "name",
				required: true,
				placeholder: "联系人姓名",
			},
			cls: "friend-tracker-modal-input",
		});
		nameInput.focus();

		// Aliases field
		const aliasesField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		aliasesField.createEl("label", { text: "别名" });
		const aliasesInput = aliasesField.createEl("input", {
			attr: {
				type: "text",
				name: "aliases",
				placeholder: "多个别名用逗号分隔",
			},
			cls: "friend-tracker-modal-input",
		});

		// Birthday field
		const birthdayField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		birthdayField.createEl("label", { text: "生日" });
		const birthdayInput = createBirthdayInput(birthdayField);

		// Email field
		const emailField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		emailField.createEl("label", { text: "邮箱" });
		const emailInput = emailField.createEl("input", {
			attr: {
				type: "email",
				name: "email",
				placeholder: "email@example.com",
			},
			cls: "friend-tracker-modal-input",
		});

		// Phone field
		const phoneField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		phoneField.createEl("label", { text: "电话" });
		const phoneInput = phoneField.createEl("input", {
			attr: {
				type: "tel",
				name: "phone",
				placeholder: "13800000000",
			},
			cls: "friend-tracker-modal-input",
		});

		// Relationship field
		const relationshipField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		relationshipField.createEl("label", { text: "关系" });
		const relationshipInput = createRelationshipInput(
			relationshipField,
			this.plugin
		);

		// Submit button
		form.createEl("button", {
			text: "创建联系人",
			attr: { type: "submit" },
			cls: "friend-tracker-button button-primary",
		});

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const data: Record<string, string | string[]> = {
				name: nameInput.value,
			};

			const aliases = parseAliases(aliasesInput.value);
			if (aliases.length > 0) data.aliases = aliases;

			if (!birthdayInput.isValid()) {
				new Notice(
					"生日填写有误：月份和日期请使用类似 08-16 的写法，年份请填 4 位数字。"
				);
				return;
}

const birthday = birthdayInput.getValue();
if (birthday) data.birthday = birthday;
			if (emailInput.value) data.email = emailInput.value;
			if (phoneInput.value) data.phone = phoneInput.value;
			if (relationshipInput.value) {
				const relationship = relationshipInput.value.toLowerCase();
				data.relationship = relationshipInput.value.toLowerCase();
				// Add new relationship type to settings if it doesn't exist
				if (
					!this.plugin.settings.relationshipTypes.includes(
						relationship
					)
				) {
					// Remove any duplicates (case-insensitive) before adding
					this.plugin.settings.relationshipTypes = [
						...new Set(
							this.plugin.settings.relationshipTypes.filter(
								(type) => type.toLowerCase() !== relationship
							)
						),
						relationship,
					];
					this.plugin.saveSettings();
				}
			}

			if (data.name) {
				this.onSubmit(data);
				this.close();
			}
		});
	}

	private async onSubmit(data: Record<string, string | string[]>) {
		const fileName = `${data.name}.md`;
		const filePath = `${this.plugin.settings.contactsFolder}/${fileName}`;

		// Ensure folder exists before creating contact
		const folder = this.plugin.settings.contactsFolder;
		if (!this.app.vault.getFolderByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		// Create YAML frontmatter
		const yaml = stringifyYaml(data);
		const fileContent = `---\n${yaml}\n---\n`;

		try {
			await this.app.vault.create(filePath, fileContent);

			// Wait a moment for the file to be indexed
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Refresh the Friend Tracker view
			const friendTrackerLeaves = this.app.workspace.getLeavesOfType(
				VIEW_TYPE_FRIEND_TRACKER
			);

			for (const leaf of friendTrackerLeaves) {
				const view = leaf.view;
				if (view instanceof FriendTrackerView) {
					await view.refresh();
					break;
				}
			}

			new Notice(`已创建联系人：${data.name}`);
		} catch (error) {
			new Notice(`创建联系人出错：${error}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
