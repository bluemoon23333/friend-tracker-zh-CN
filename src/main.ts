import { Plugin, Notice } from "obsidian";
import { FriendTrackerSettings, DEFAULT_SETTINGS } from "./types";
import {
	FriendTrackerView,
	VIEW_TYPE_FRIEND_TRACKER,
} from "./views/FriendTrackerView";
import {
	ContactPageView,
	VIEW_TYPE_CONTACT_PAGE,
} from "@/views/ContactPageView";
import { FriendTrackerSettingTab } from "./views/FriendTrackerView/settings";
import { ContactOperations } from "@/services/ContactOperations";
import { MentionIndex } from "@/services/MentionIndex";

export default class FriendTracker extends Plugin {
	settings: FriendTrackerSettings;
	public contactOperations: ContactOperations;
	public mentionIndex: MentionIndex;

	async onload() {
		await this.loadSettings();
		this.contactOperations = new ContactOperations(this);
		this.mentionIndex = new MentionIndex(this);

		// 库内容变化时让「提及索引」失效，下次读取联系人时重建
		const invalidateMentionIndex = () => this.mentionIndex.invalidate();
		this.registerEvent(this.app.vault.on("create", invalidateMentionIndex));
		this.registerEvent(this.app.vault.on("modify", invalidateMentionIndex));
		this.registerEvent(this.app.vault.on("delete", invalidateMentionIndex));
		this.registerEvent(this.app.vault.on("rename", invalidateMentionIndex));

		// On mobile, we should wait for layout-ready
		this.app.workspace.onLayoutReady(() => {
			this.initialize();
		});
	}

	private async initialize() {
		try {
			// Register views
			this.registerView(
				VIEW_TYPE_FRIEND_TRACKER,
				(leaf) => new FriendTrackerView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_CONTACT_PAGE,
				(leaf) => new ContactPageView(leaf, this)
			);

			// Add ribbon icon
			this.addRibbonIcon("user", "打开好友追踪", async () => {
				const workspace = this.app.workspace;
				const leaves = workspace.getLeavesOfType(
					VIEW_TYPE_FRIEND_TRACKER
				);

				// Check for existing view, handling deferred views
				for (const leaf of leaves) {
					const view = await leaf.view;
					if (view instanceof FriendTrackerView) {
						workspace.revealLeaf(leaf);
						return;
					}
				}

				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_FRIEND_TRACKER,
						active: true,
					});
					workspace.revealLeaf(leaf);
				} else {
					new Notice("无法创建好友追踪视图");
				}
			});

			// Add settings tab
			this.addSettingTab(new FriendTrackerSettingTab(this.app, this));

			// Check for birthdays after everything is initialized
			await this.checkBirthdays();
		} catch (error) {
			console.error("好友追踪加载失败：", error);
			new Notice("好友追踪加载失败：" + error.message);
		}
	}

	private async checkBirthdays() {
		const contacts = await this.contactOperations.getContacts();
		const birthdayContacts = contacts.filter(
			(c) => c.daysUntilBirthday === 0
		);

		if (birthdayContacts.length > 0) {
			if (birthdayContacts.length === 1) {
				new Notice(
					`🎂 今天是 ${birthdayContacts[0].name} 的生日！`,
					8000 // 显示 8 秒
				);
			} else {
				const names = birthdayContacts.map((c) => c.name);
				const lastPerson = names.pop();
				const nameList = names.join("、") + "和" + lastPerson;
				new Notice(`🎂 今天是 ${nameList} 的生日！`, 8000);
			}
		}

		// 可选：同时提醒明天的生日
		const tomorrowBirthdays = contacts.filter(
			(c) => c.daysUntilBirthday === 1
		);
		if (tomorrowBirthdays.length > 0) {
			if (tomorrowBirthdays.length === 1) {
				new Notice(
					`🎈 明天是 ${tomorrowBirthdays[0].name} 的生日！`,
					6000 // 显示 6 秒（明天的生日提醒稍短一些）
				);
			} else {
				const names = tomorrowBirthdays.map((c) => c.name);
				const lastPerson = names.pop();
				const nameList = names.join("、") + "和" + lastPerson;
				new Notice(`🎈 明天是 ${nameList} 的生日！`, 6000);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
		// Remove the datalist from document.body if it exists
		const datalist = document.getElementById("relationship-types");
		if (datalist) {
			datalist.remove();
		}
	}
}
