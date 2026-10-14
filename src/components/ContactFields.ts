import type { ContactPageView } from "@/views/ContactPageView";
import { STANDARD_FIELDS } from "@/constants";
import type FriendTracker from "@/main";
import { parseBirthday, toBirthdayString } from "@/utils/birthday";

export function createRelationshipInput(
	container: HTMLElement,
	plugin: FriendTracker,
	value: string = "",
	onChange?: (value: string) => void
) {
	const input = container.createEl("input", {
		cls: "friend-tracker-modal-input",
		attr: {
			type: "text",
			value: value || "",
			placeholder: "朋友、家人、同事等",
			list: "relationship-types",
			autocomplete: "on",
			role: "combobox",
			"aria-autocomplete": "list",
		},
	});

	// Create or get existing datalist
	let datalist = document.getElementById(
		"relationship-types"
	) as HTMLDataListElement;
	if (!datalist) {
		datalist = document.createElement("datalist");
		datalist.id = "relationship-types";
		document.body.appendChild(datalist);
	}

	// Update options
	const updateDatalist = (filter?: string) => {
		datalist.empty();
		const types = plugin.settings.relationshipTypes;
		types
			.filter((type) => !filter || type.includes(filter.toLowerCase()))
			.forEach((type) => {
				const option = datalist.createEl("option");
				option.text = type.charAt(0).toUpperCase() + type.slice(1);
			});
	};

	updateDatalist();

	// Add input event listener for immediate feedback
	input.addEventListener("input", () => {
		updateDatalist(input.value);
	});

	if (onChange) {
		input.addEventListener("change", () => {
			onChange(input.value);
		});
	}

	return input;
}

// 生日输入组件：支持「只填月日、不填年份」的写法
export interface BirthdayInputHandle {
	wrapper: HTMLElement;
	// 读取当前填写的生日，格式不合法时返回空字符串
	getValue: () => string;
	// 输入内容是否合法（留空视为合法）
	isValid: () => boolean;
}

export function createBirthdayInput(
	container: HTMLElement,
	value: string = "",
	onChange?: (value: string) => void
): BirthdayInputHandle {
	const parsed = parseBirthday(value);

	const wrapper = container.createEl("div", {
		cls: "friend-tracker-birthday-inputs",
	});

	const monthDayInput = wrapper.createEl("input", {
		cls: "contact-field-input",
		attr: {
			type: "text",
			inputmode: "numeric",
			placeholder: "月-日，如 08-16",
			value: parsed
				? toBirthdayString(null, parsed.month, parsed.day)
				: "",
		},
	});

	const yearInput = wrapper.createEl("input", {
		cls: "contact-field-input friend-tracker-birthday-year",
		attr: {
			type: "text",
			inputmode: "numeric",
			placeholder: "出生年份（可选）",
			value: parsed && parsed.year ? String(parsed.year) : "",
		},
	});

	wrapper.createEl("div", {
		cls: "friend-tracker-birthday-hint",
		text: "只知道生日、不知道年份时，只填「月-日」即可。",
	});

	let lastEmitted: string | null = null;

	const readValue = () => {
		const rawMonthDay = monthDayInput.value.trim();
		const rawYear = yearInput.value.trim();
		const monthDay = rawMonthDay ? parseBirthday(rawMonthDay) : null;
		const monthDayInvalid =
			(rawMonthDay !== "" && !monthDay) ||
			(rawMonthDay === "" && rawYear !== "");
		const yearInvalid = rawYear !== "" && !/^\d{4}$/.test(rawYear);

		return { rawYear, monthDay, monthDayInvalid, yearInvalid };
	};

	const getValue = () => {
		const current = readValue();
		if (current.monthDayInvalid || current.yearInvalid) return "";
		if (!current.monthDay) return "";
		const year = current.rawYear === "" ? null : Number(current.rawYear);
		return toBirthdayString(
			year,
			current.monthDay.month,
			current.monthDay.day
		);
	};

	const isValid = () => {
		const current = readValue();
		return !current.monthDayInvalid && !current.yearInvalid;
	};

	const emit = () => {
		const current = readValue();
		monthDayInput.classList.toggle(
			"is-invalid",
			current.monthDayInvalid
		);
		yearInput.classList.toggle("is-invalid", current.yearInvalid);
		if (current.monthDayInvalid || current.yearInvalid) return;

		const composed = getValue();
		if (composed !== lastEmitted) {
			lastEmitted = composed;
			if (onChange) onChange(composed);
		}
	};

	monthDayInput.addEventListener("change", emit);
	monthDayInput.addEventListener("blur", emit);
	yearInput.addEventListener("change", emit);
	yearInput.addEventListener("blur", emit);

	return { wrapper, getValue, isValid };
}

export class ContactFields {
	constructor(private view: ContactPageView) {}

	private createRelationshipField(container: HTMLElement, value: string) {
		const input = createRelationshipInput(
			container,
			this.view.plugin,
			value,
			async (newValue) => {
				const relationship = newValue.toLowerCase();
				await this.view.updateContactData(
					STANDARD_FIELDS.RELATIONSHIP,
					relationship
				);

				// Add new type if it doesn't exist
				if (
					relationship &&
					!this.view.getRelationshipTypes().includes(relationship)
				) {
					const types = this.view
						.getRelationshipTypes()
						.filter((type) => type.toLowerCase() !== relationship);
					await this.view.addRelationshipType(relationship, types);
				}
			}
		);
		input.className = "contact-field-input";
	}

	createInfoField(container: HTMLElement, label: string, value: string) {
		const field = container.createEl("div", { cls: "contact-field" });
		field.createEl("label", { text: label });

		if (label.toLowerCase() === STANDARD_FIELDS.BIRTHDAY) {
			this.createBirthdayField(field, value);
		} else if (label.toLowerCase() === STANDARD_FIELDS.PHONE) {
			this.createPhoneField(field, value);
		} else if (label.toLowerCase() === STANDARD_FIELDS.RELATIONSHIP) {
			this.createRelationshipField(field, value);
		} else {
			this.createTextField(field, label, value);
		}
	}

	private createBirthdayField(container: HTMLElement, value: string) {
		createBirthdayInput(container, value, async (newValue) => {
			if (!this.view.file) return;
			await this.view.updateContactData("birthday", newValue);
		});
	}

	private createPhoneField(container: HTMLElement, value: string) {
		const input = container.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "tel",
				value: value || "",
				placeholder: "13800000000",
				pattern: "^[0-9+\\-]*$", // Allow only numbers, +, and -
			},
		});

		input.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			target.value = target.value.replace(/[^0-9+-]/g, ""); // Keep only numbers, +, and -
		});

		input.addEventListener("change", async () => {
			await this.view.updateContactData("phone", input.value);
		});
	}

	private createTextField(
		container: HTMLElement,
		label: string,
		value: string
	) {
		const input = container.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "text",
				value: value || "",
				placeholder: "未设置",
			},
		});

		input.addEventListener("change", async () => {
			await this.view.updateContactData(label.toLowerCase(), input.value);
		});
	}
}
