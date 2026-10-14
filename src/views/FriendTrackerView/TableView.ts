import { setIcon } from "obsidian";
import type { FriendTrackerView } from "./index";
import type { ContactWithCountdown, SortConfig } from "@/types";
import { parseBirthday } from "@/utils/birthday";

export class TableView {
	constructor(private view: FriendTrackerView) {}

	async render(
		container: HTMLElement,
		contacts: ContactWithCountdown[],
		sort: SortConfig
	) {
		// Create header and add contact button container
		const headerContainer = container.createEl("div", {
			cls: "friend-tracker-header",
		});
		headerContainer.createEl("h2", { text: "好友追踪" });

		const addButton = headerContainer.createEl("button", {
			text: "添加联系人",
			cls: "friend-tracker-button button-outlined",
		});
		addButton.addEventListener("click", () =>
			this.view.openAddContactModal()
		);

		const content = container.createEl("div", {
			cls: "friend-tracker-content",
		});

		if (contacts.length === 0) {
			const emptyState = content.createEl("div", {
				cls: "friend-tracker-empty-state",
			});
			emptyState.createEl("p", {
				text: "暂无联系人。创建第一位联系人，开始使用吧！",
			});
			return;
		}

		// Create scrollable container for table
		const tableContainer = content.createEl("div", {
			cls: "friend-tracker-table-container",
		});

		// Create table for contacts
		const table = tableContainer.createEl("table", {
			cls: "friend-tracker-table",
		}) as HTMLTableElement;

		this.renderTableHeader(table, sort);
		this.renderTableRows(table, contacts);
	}

	private renderTableHeader(table: HTMLTableElement, sort: SortConfig) {
		const headerRow = table.createEl("tr") as HTMLTableRowElement;
		const columns: Array<{
			key: keyof Omit<ContactWithCountdown, "file"> | "actions";
			label: string;
			sortable?: boolean;
		}> = [
			{ key: "name", label: "姓名", sortable: true },
			{ key: "age", label: "年龄", sortable: true },
			{ key: "birthday", label: "生日", sortable: true },
			{ key: "daysUntilBirthday", label: "距生日天数", sortable: true },
			{ key: "relationship", label: "关系", sortable: true },
			{
				key: "lastInteraction",
				label: "最近互动",
				sortable: true,
			},
			{ key: "actions", label: "", sortable: false },
		];

		columns.forEach(({ key, label, sortable }) => {
			const th = headerRow.createEl("th");

			if (sortable) {
				const button = th.createEl("button", {
					cls: "friend-tracker-sort-button",
				});

				// Add text span
				button.createEl("span", { text: label });

				// Add sort indicator span
				button.createEl("span", {
					cls: "sort-indicator",
					text:
						sort.column === key
							? sort.direction === "asc"
								? "↑"
								: "↓"
							: "",
				});

				button.addEventListener("click", () => {
					if (key !== "actions") {
						this.view.handleSort(
							key as keyof Omit<ContactWithCountdown, "file">
						);
					}
				});
			} else {
				th.setText(label);
			}
		});
	}

	private renderTableRows(
		table: HTMLTableElement,
		contacts: ContactWithCountdown[]
	) {
		// Sort contacts based on current sort configuration
		const sortedContacts = this.sortContacts(
			contacts,
			this.view.currentSort
		);

		sortedContacts.forEach((contact) => {
			const row = table.createEl("tr") as HTMLTableRowElement;

			// Create name cell with click handler
			const nameCell = this.renderNameCell(contact);
			row.appendChild(nameCell); // Add the name cell to the row
			nameCell.addEventListener("click", (e) => {
				e.stopPropagation(); // Stop event from bubbling
				this.view.openContact(contact.file);
			});

			// Rest of the cells (no click handlers)
			row.createEl("td", { text: contact.age?.toString() || "—" });
			row.createEl("td", {
				text: contact.formattedBirthday || "—",
			});
			row.createEl("td", {
				text:
					contact.daysUntilBirthday !== null
						? `${contact.daysUntilBirthday} 天`
						: "—",
			});
			row.createEl("td", {
				text: contact.relationship || "—",
				cls: "friend-tracker-relationship-cell",
			});
			const lastInteractionCell = row.createEl("td", {
				text: contact.lastInteraction || "",
			});
			if (contact.lastInteraction && contact.lastInteractionSource) {
				lastInteractionCell.setAttr(
					"aria-label",
					`来自笔记「${contact.lastInteractionSource}」`
				);
			}

			// Actions cell
			const actionsCell = row.createEl("td", {
				cls: "friend-tracker-actions",
			});

			// Delete button
			const deleteButton = actionsCell.createEl("button", {
				cls: "friend-tracker-delete-button",
				attr: { "aria-label": "删除联系人" },
			});
			setIcon(deleteButton, "trash");

			deleteButton.addEventListener("click", (e) => {
				e.stopPropagation();
				this.view.openDeleteModal(contact.file);
			});
		});
	}

	private renderNameCell(contact: ContactWithCountdown): HTMLElement {
		const cell = document.createElement("td");
		cell.className = "friend-tracker-name-cell";

		if (contact.daysUntilBirthday !== null) {
			if (contact.daysUntilBirthday === 0) {
				// Birthday today - show cake
				const indicator = cell.createEl("div", {
					cls: "table-birthday-indicator birthday-today",
					text: "🎂",
				});
			} else if (contact.daysUntilBirthday <= 7) {
				// Within a week - show green dot
				const dotContainer = cell.createEl("div", {
					cls: "table-birthday-status-dot",
				});
				dotContainer.createEl("div", {
					cls: "table-birthday-status-dot-inner",
				});
			}
		}

		cell.createSpan({ text: contact.name });

		return cell;
	}

	private sortContacts(contacts: ContactWithCountdown[], sort: SortConfig) {
		return [...contacts].sort((a, b) => {
			if (sort.column === "birthday") {
				// 按「月-日」排序，支持不填出生年份的生日
				const parsedA = parseBirthday(a.birthday);
				const parsedB = parseBirthday(b.birthday);

				if (!parsedA && !parsedB) return 0;
				if (!parsedA) return 1;
				if (!parsedB) return -1;

				const aValue = parsedA.month * 100 + parsedA.day;
				const bValue = parsedB.month * 100 + parsedB.day;

				return sort.direction === "asc"
					? aValue - bValue
					: bValue - aValue;
			}

			// 最近互动按时间戳排序（提及模式下为按提及推算出的时间）
			if (sort.column === "lastInteraction") {
				const aTime = a.lastInteractionTime;
				const bTime = b.lastInteractionTime;

				if (aTime === null && bTime === null) return 0;
				if (aTime === null) return 1;
				if (bTime === null) return -1;

				return sort.direction === "asc"
					? aTime - bTime
					: bTime - aTime;
			}

			// Add special handling for daysUntilBirthday
			if (sort.column === "daysUntilBirthday") {
				// Handle null values
				if (
					a.daysUntilBirthday === null &&
					b.daysUntilBirthday === null
				)
					return 0;
				if (a.daysUntilBirthday === null) return 1;
				if (b.daysUntilBirthday === null) return -1;

				// Normal numeric comparison that respects sort direction
				return (
					(a.daysUntilBirthday - b.daysUntilBirthday) *
					(sort.direction === "asc" ? 1 : -1)
				);
			}

			const aValue = a[sort.column];
			const bValue = b[sort.column];

			// Handle null/empty values in sorting
			if (!aValue && !bValue) return 0;
			if (!aValue) return 1;
			if (!bValue) return -1;

			// Sort direction
			const direction = sort.direction === "asc" ? 1 : -1;

			// Handle different types of values
			if (sort.column === "relationship" || sort.column === "name") {
				// Case-insensitive string comparison for text columns
				const aStr = String(aValue).toLowerCase();
				const bStr = String(bValue).toLowerCase();
				return aStr < bStr ? -direction : aStr > bStr ? direction : 0;
			} else if (
				typeof aValue === "number" &&
				typeof bValue === "number"
			) {
				// Numeric comparison
				return (aValue - bValue) * direction;
			}

			// Default string comparison
			return aValue < bValue
				? -direction
				: aValue > bValue
				? direction
				: 0;
		});
	}
}
