type StandardFieldKey = keyof typeof STANDARD_FIELDS;
type StandardFieldValue = (typeof STANDARD_FIELDS)[StandardFieldKey];

export const STANDARD_FIELDS = {
	NAME: "name",
	ALIASES: "aliases",
	BIRTHDAY: "birthday",
	EMAIL: "email",
	PHONE: "phone",
	ADDRESS: "address",
	RELATIONSHIP: "relationship",
	INTERACTIONS: "interactions",
	CREATED: "created",
	UPDATED: "updated",
	NOTES: "notes",
	EXTRAS: "extras",
} as const;

// System fields that shouldn't be shown as custom fields
export const SYSTEM_FIELDS: StandardFieldValue[] = [
	STANDARD_FIELDS.NAME,
	STANDARD_FIELDS.INTERACTIONS,
	STANDARD_FIELDS.CREATED,
	STANDARD_FIELDS.UPDATED,
	STANDARD_FIELDS.NOTES,
	STANDARD_FIELDS.EXTRAS,
];

// Fields that have special input handling
export const SPECIAL_INPUT_FIELDS = {
	[STANDARD_FIELDS.BIRTHDAY]: "date",
	[STANDARD_FIELDS.PHONE]: "tel",
	[STANDARD_FIELDS.EMAIL]: "email",
} as const;

// 标准字段对应的中文显示名称
export const FIELD_LABELS: Record<string, string> = {
	[STANDARD_FIELDS.NAME]: "姓名",
	[STANDARD_FIELDS.ALIASES]: "别名",
	[STANDARD_FIELDS.BIRTHDAY]: "生日",
	[STANDARD_FIELDS.EMAIL]: "邮箱",
	[STANDARD_FIELDS.PHONE]: "电话",
	[STANDARD_FIELDS.ADDRESS]: "地址",
	[STANDARD_FIELDS.RELATIONSHIP]: "关系",
	[STANDARD_FIELDS.INTERACTIONS]: "互动记录",
	[STANDARD_FIELDS.CREATED]: "创建时间",
	[STANDARD_FIELDS.UPDATED]: "更新时间",
	[STANDARD_FIELDS.NOTES]: "备注",
	[STANDARD_FIELDS.EXTRAS]: "附加内容",
};

// 获取字段的中文显示名称（自定义字段保持原名）
export function getFieldLabel(field: string): string {
	return FIELD_LABELS[field.toLowerCase()] || field;
}
