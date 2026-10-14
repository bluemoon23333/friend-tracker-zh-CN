import { Notice, TFile, parseYaml } from "obsidian";
import type FriendTracker from "@/main";
import type { ContactWithCountdown } from "@/types";
import { parseBirthday } from "@/utils/birthday";
import { parseAliases } from "@/utils/aliases";
import {
	formatDaysAgo,
	parseDateToLocalMidnight,
} from "@/utils/dates";

export class ContactOperations {
	constructor(private plugin: FriendTracker) {}

	async getContacts(): Promise<ContactWithCountdown[]> {
		const folder = this.plugin.settings.contactsFolder;
		const vault = this.plugin.app.vault;
		const folderPath = vault.getFolderByPath(folder);

		if (!folderPath) {
			new Notice("未找到好友追踪文件夹。");
			return [];
		}

		const files = folderPath.children.filter(
			(file) => file instanceof TFile
		);
		const contacts: ContactWithCountdown[] = [];

		for (const file of files) {
			if (!(file instanceof TFile)) continue;

			try {
				// Read the file content directly instead of relying on metadata cache
				const content = await vault.read(file);
				const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);

				if (yamlMatch) {
					const metadata = parseYaml(yamlMatch[1]);

					const manualInteractionDate =
						metadata.interactions?.length > 0
							? metadata.interactions[0].date
							: null;
					const manualInteractionTime = parseDateToLocalMidnight(
						manualInteractionDate
					);

					contacts.push({
						name: metadata.name || "未知",
						aliases: parseAliases(metadata.aliases ?? metadata.alias),
						birthday: metadata.birthday || "",
						formattedBirthday: this.formatBirthday(
							metadata.birthday
						),
						relationship: metadata.relationship || "",
						age: this.calculateAge(metadata.birthday),
						daysUntilBirthday: this.calculateDaysUntilBirthday(
							metadata.birthday
						),
						lastInteraction:
							manualInteractionTime !== null
								? formatDaysAgo(manualInteractionTime)
								: null,
						lastInteractionTime: manualInteractionTime,
						lastInteractionSource: null,
						file,
					});
				}
			} catch (error) {
				console.error(
					`读取联系人文件出错：${file.path}`,
					error
				);
			}
		}

		// 「提及记录」模式下，用库中的提及推算「最近互动」
		if (this.plugin.settings.interactionMode === "mentions") {
			const summaries = await this.plugin.mentionIndex.getSummaries(
				contacts
			);

			for (const contact of contacts) {
				const summary = summaries.get(contact.file.path);
				if (!summary) continue;

				// 提及比手动记录更近时才覆盖
				if (
					contact.lastInteractionTime === null ||
					summary.time > contact.lastInteractionTime
				) {
					contact.lastInteraction = formatDaysAgo(summary.time);
					contact.lastInteractionTime = summary.time;
					contact.lastInteractionSource = summary.source;
				}
			}
		}

		return contacts;
	}

	private calculateAge(birthday: string): number | null {
		const parsed = parseBirthday(birthday);
		if (!parsed || !parsed.year) return null;

		// Parse the birthday and set it to local midnight
		const birthDate = new Date(parsed.year, parsed.month - 1, parsed.day);
		birthDate.setHours(0, 0, 0, 0);

		if (isNaN(birthDate.getTime())) return null;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();

		if (
			monthDiff < 0 ||
			(monthDiff === 0 && today.getDate() < birthDate.getDate())
		) {
			age--;
		}

		return age;
	}

	public calculateDetailedAge(birthday: string): string {
		const parsed = parseBirthday(birthday);
		if (!parsed || !parsed.year) return "";

		// Parse the birthday and set it to local midnight
		const birthDate = new Date(parsed.year, parsed.month - 1, parsed.day);
		birthDate.setHours(0, 0, 0, 0);

		if (isNaN(birthDate.getTime())) return "";

		// Get today at local midnight
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let years = today.getFullYear() - birthDate.getFullYear();
		let months = today.getMonth() - birthDate.getMonth();
		let days = today.getDate() - birthDate.getDate();

		// Adjust for negative days
		if (days < 0) {
			months--;
			// Get last day of previous month
			const lastMonth = new Date(
				today.getFullYear(),
				today.getMonth(),
				0
			);
			days += lastMonth.getDate();
		}

		// Adjust for negative months
		if (months < 0) {
			years--;
			months += 12;
		}

		// Format the output
		const parts: string[] = [];

		if (years > 0) {
			parts.push(`${years} 岁`);
		}

		if (months > 0) {
			parts.push(`${months} 个月`);
		}

		if (days > 0) {
			parts.push(`${days} 天`);
		}

		return parts.length > 0 ? parts.join(" ") : "刚出生";
	}

	private formatBirthday(dateStr: string): string {
		if (!dateStr) return "";

		const parsed = parseBirthday(dateStr);
		if (!parsed) return String(dateStr);

		return `${parsed.month}月${parsed.day}日`;
	}

	public calculateDaysUntilBirthday(birthday: string): number | null {
		const parsed = parseBirthday(birthday);
		if (!parsed) return null;

		// Get today at local midnight
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Create this year's birthday at local midnight
		const thisYearBirthday = new Date(
			today.getFullYear(),
			parsed.month - 1,
			parsed.day
		);
		thisYearBirthday.setHours(0, 0, 0, 0);

		// If this year's birthday has already passed, use next year's birthday
		if (thisYearBirthday < today) {
			thisYearBirthday.setFullYear(today.getFullYear() + 1);
		}

		// Calculate days difference
		const diffTime = thisYearBirthday.getTime() - today.getTime();
		return Math.round(diffTime / (1000 * 60 * 60 * 24));
	}
}
