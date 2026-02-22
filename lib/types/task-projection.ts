export const PROJECTION_KINDS = [
  "custom",
  "list",
  "kanban",
  "timeline",
  "calendar",
  "table",
  "matrix",
] as const;

export type ProjectionKind = (typeof PROJECTION_KINDS)[number];

export const TASK_ENTITY_KINDS = ["todo", "sub_todo"] as const;

export type TaskEntityKind = (typeof TASK_ENTITY_KINDS)[number];

export type TaskEntityRef = {
  taskKind: TaskEntityKind;
  taskId: string;
};

export const TASK_RELATIONSHIP_KINDS = [
  "blocks",
  "related_to",
  "duplicates",
  "parent_child",
  "depends_on",
] as const;

export type TaskRelationshipKind = (typeof TASK_RELATIONSHIP_KINDS)[number];

export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "single_select",
  "multi_select",
  "json",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_APPLIES_TO = ["todo", "sub_todo", "both"] as const;

export type CustomFieldAppliesTo = (typeof CUSTOM_FIELD_APPLIES_TO)[number];

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number]
): T[number] {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return options.includes(normalized as T[number])
    ? (normalized as T[number])
    : fallback;
}

export function isProjectionKind(value: unknown): value is ProjectionKind {
  return (
    typeof value === "string" &&
    PROJECTION_KINDS.includes(value as ProjectionKind)
  );
}

export function normalizeProjectionKind(
  value: unknown,
  fallback: ProjectionKind = "custom"
): ProjectionKind {
  return normalizeEnum(value, PROJECTION_KINDS, fallback);
}

export function isTaskEntityKind(value: unknown): value is TaskEntityKind {
  return (
    typeof value === "string" &&
    TASK_ENTITY_KINDS.includes(value as TaskEntityKind)
  );
}

export function normalizeTaskEntityKind(
  value: unknown,
  fallback: TaskEntityKind = "todo"
): TaskEntityKind {
  return normalizeEnum(value, TASK_ENTITY_KINDS, fallback);
}

export function isTaskRelationshipKind(
  value: unknown
): value is TaskRelationshipKind {
  return (
    typeof value === "string" &&
    TASK_RELATIONSHIP_KINDS.includes(value as TaskRelationshipKind)
  );
}

export function normalizeTaskRelationshipKind(
  value: unknown,
  fallback: TaskRelationshipKind = "depends_on"
): TaskRelationshipKind {
  return normalizeEnum(value, TASK_RELATIONSHIP_KINDS, fallback);
}

export function isCustomFieldType(value: unknown): value is CustomFieldType {
  return (
    typeof value === "string" &&
    CUSTOM_FIELD_TYPES.includes(value as CustomFieldType)
  );
}

export function normalizeCustomFieldType(
  value: unknown,
  fallback: CustomFieldType = "text"
): CustomFieldType {
  return normalizeEnum(value, CUSTOM_FIELD_TYPES, fallback);
}

export function isCustomFieldAppliesTo(
  value: unknown
): value is CustomFieldAppliesTo {
  return (
    typeof value === "string" &&
    CUSTOM_FIELD_APPLIES_TO.includes(value as CustomFieldAppliesTo)
  );
}

export function normalizeCustomFieldAppliesTo(
  value: unknown,
  fallback: CustomFieldAppliesTo = "both"
): CustomFieldAppliesTo {
  return normalizeEnum(value, CUSTOM_FIELD_APPLIES_TO, fallback);
}

export function normalizeCustomFieldKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getTaskEntityId(taskRef: TaskEntityRef): string {
  return taskRef.taskId;
}
