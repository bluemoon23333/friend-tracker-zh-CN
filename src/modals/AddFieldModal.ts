import { App, Modal } from "obsidian";

export class AddFieldModal extends Modal {
	private onSubmit: (fieldName: string) => void;

	constructor(app: App, onSubmit: (fieldName: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "添加自定义字段" });

		const form = contentEl.createEl("form");
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const input = form.querySelector("input");
			if (input?.value) {
				this.onSubmit(input.value.toLowerCase());
				this.close();
			}
		});

		const input = form.createEl("input", {
			attr: {
				type: "text",
				placeholder: "字段名称",
				pattern: "[a-zA-Z\\u4e00-\\u9fa5][a-zA-Z0-9\\u4e00-\\u9fa5]*",
			},
			cls: "contact-field-input",
		});
		input.focus();

		form.createEl("button", {
			text: "添加字段",
			attr: { type: "submit" },
			cls: "friend-tracker-button button-primary button-full-width",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
