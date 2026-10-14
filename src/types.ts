import { TFile } from "obsidian";

// 互动记录模式：manual = 手动记录，mentions = 显示库中提及该联系人的内容
export type InteractionMode = "manual" | "mentions";

// 「提及记录」的搜索范围：vault = 整个库，folder = 只搜索指定文件夹
export type MentionSearchScope = "vault" | "folder";

// 「提及记录」列表的排序方式（与 Obsidian 反向链接面板的排序选项一致）
export type MentionSortOrder =
	| "name-asc"
	| "name-desc"
	| "mtime-desc"
	| "mtime-asc"
	| "ctime-desc"
	| "ctime-asc";

export interface FriendTrackerSettings {
	contactsFolder: string;
	defaultSortColumn: keyof Omit<ContactWithCountdown, "file">;
	defaultSortDirection: "asc" | "desc";
	relationshipTypes: string[];
	defaultActiveTab: "notes" | "interactions" | "markdown";
	interactionMode: InteractionMode;
	mentionsSortOrder: MentionSortOrder;
	mentionsSearchScope: MentionSearchScope;
	mentionsFolder: string;
}

export interface Contact {
	name: string;
	aliases: string[];
	birthday: string;
	relationship: string;
	age: number | null;
	file: TFile;
}

export interface ContactWithCountdown extends Contact {
	formattedBirthday: string;
	daysUntilBirthday: number | null;
	lastInteraction: string | null;
	// 最近互动的时间戳，用于排序（提及模式下会按库中的提及推算）
	lastInteractionTime: number | null;
	// 提及模式下来源笔记名，用于提示
	lastInteractionSource: string | null;
}

export interface SortConfig {
	column: keyof Omit<ContactWithCountdown, "file">;
	direction: "asc" | "desc";
}

export interface Interaction {
	date: string;
	text: string;
}

export const DEFAULT_SETTINGS: FriendTrackerSettings = {
	contactsFolder: "好友追踪",
	defaultSortColumn: "daysUntilBirthday",
	defaultSortDirection: "asc",
	relationshipTypes: ["家人", "朋友", "同事", "宠物"],
	defaultActiveTab: "notes",
	interactionMode: "manual",
	mentionsSortOrder: "mtime-desc",
	mentionsSearchScope: "vault",
	mentionsFolder: "",
};
