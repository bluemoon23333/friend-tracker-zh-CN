import { App, Modal, TFile } from "obsidian";

export class DeleteContactModal extends Modal {
	constructor(
		app: App,
		private file: TFile,
		private onDelete: () => Promise<void>
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "删除联系人" });
		contentEl.createEl("p", {
			text: `确定要删除「${this.file.basename}」吗？`,
		});

		const buttonContainer = contentEl.createEl("div", {
			cls: "friend-tracker-modal-buttons",
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", {
			text: "取消",
			cls: "friend-tracker-modal-button",
		});
		cancelButton.addEventListener("click", () => this.close());

		// Delete button
		const deleteButton = buttonContainer.createEl("button", {
			text: "删除",
			cls: "friend-tracker-modal-button friend-tracker-modal-button-danger",
		});
		deleteButton.addEventListener("click", async () => {
			await this.onDelete();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
