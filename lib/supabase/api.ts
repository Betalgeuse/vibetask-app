"use client";

import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from "@/lib/i18n";
import {
  PRIORITY_QUADRANTS,
  QUADRANT_TO_LEGACY_PRIORITY,
  isDoneStatus,
  isTodoStatus,
  normalizePriorityQuadrant,
  normalizeTodoStatus,
  type PriorityQuadrant,
  type TodoStatus,
} from "@/lib/types/priority";
import {
  DEFAULT_TASK_MODULE_FLAGS,
  normalizeWorkflowStatus,
  normalizeTaskModuleFlags,
  type TaskModuleFlags,
  type TaskPayload,
  type WorkflowStatus,
} from "@/lib/types/task-payload";
import {
  normalizeCustomFieldAppliesTo,
  normalizeCustomFieldKey,
  normalizeCustomFieldType,
  normalizeProjectionKind,
  normalizeTaskEntityKind,
  normalizeTaskRelationshipKind,
  type CustomFieldAppliesTo,
  type CustomFieldType,
  type ProjectionKind,
  type TaskEntityRef,
  type TaskRelationshipKind,
} from "@/lib/types/task-projection";
import {
  CustomFieldDefinitionDoc,
  CustomFieldValueDoc,
  Doc,
  EpicDoc,
  Id,
  LabelDoc,
  PersonaDoc,
  ProjectDoc,
  SubTodoDoc,
  TaskProjectionDoc,
  TaskProjectionPositionDoc,
  TaskRelationshipDoc,
  TodoDoc,
  UserFeatureSettingsDoc,
} from "./types";
import type { User } from "@supabase/supabase-js";

type TodoRow = {
  id: string;
  user_id: string;
  project_id: string;
  label_id: string;
  task_name: string;
  description: string | null;
  story: string | null;
  due_date: number | string;
  priority: number | string | null;
  priority_quadrant: string | null;
  status: string | null;
  workflow_status: string | null;
  workload: number | null;
  epic_id: string | null;
  persona_id: string | null;
  payload: Record<string, unknown> | null;
  is_completed: boolean | null;
  embedding: number[] | null;
};

type SubTodoRow = {
  id: string;
  user_id: string;
  project_id: string;
  label_id: string;
  parent_id: string;
  task_name: string;
  description: string | null;
  story: string | null;
  due_date: number | string;
  priority: number | string | null;
  priority_quadrant: string | null;
  status: string | null;
  workflow_status: string | null;
  workload: number | null;
  epic_id: string | null;
  persona_id: string | null;
  payload: Record<string, unknown> | null;
  is_completed: boolean | null;
  embedding: number[] | null;
};

type ProjectRow = {
  id: string;
  user_id: string | null;
  name: string;
  type: "user" | "system";
};

type LabelRow = {
  id: string;
  user_id: string | null;
  name: string;
  color: string | null;
  type: "user" | "system";
};

type EpicRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
};

type PersonaRow = {
  id: string;
  user_id: string;
  code: string;
  name: string;
  description: string | null;
  type: "user";
};

type UserFeatureSettingsRow = {
  user_id: string;
  enabled_modules: Record<string, unknown> | null;
  task_property_visibility: Record<string, unknown> | null;
  sidebar_modules: unknown[] | null;
};

type TaskProjectionRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  projection_kind: string | null;
  filters: Record<string, unknown> | null;
  sort_rules: unknown[] | null;
  lane_config: Record<string, unknown> | null;
  display_config: Record<string, unknown> | null;
  is_default: boolean | null;
  is_archived: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type TaskProjectionPositionRow = {
  id: string;
  projection_id: string;
  task_kind: string;
  todo_id: string | null;
  sub_todo_id: string | null;
  lane_key: string | null;
  lane_position: number | string | null;
  sort_rank: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type TaskRelationshipRow = {
  id: string;
  user_id: string;
  relation_kind: string | null;
  source_kind: string;
  source_todo_id: string | null;
  source_sub_todo_id: string | null;
  target_kind: string;
  target_todo_id: string | null;
  target_sub_todo_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type CustomFieldDefinitionRow = {
  id: string;
  user_id: string;
  field_key: string;
  display_name: string;
  description: string | null;
  field_type: string | null;
  applies_to: string | null;
  options: unknown[] | null;
  validation: Record<string, unknown> | null;
  is_required: boolean | null;
  is_archived: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type CustomFieldValueRow = {
  id: string;
  user_id: string;
  field_id: string;
  task_kind: string;
  todo_id: string | null;
  sub_todo_id: string | null;
  value_text: string | null;
  value_number: number | string | null;
  value_boolean: boolean | null;
  value_date: number | string | null;
  value_json: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type EisenhowerTodos = Record<PriorityQuadrant, Array<Doc<"todos">>>;

function getEmptyQuadrants(): EisenhowerTodos {
  return PRIORITY_QUADRANTS.reduce<EisenhowerTodos>(
    (acc, quadrant) => {
      acc[quadrant] = [];
      return acc;
    },
    {
      doFirst: [],
      schedule: [],
      delegate: [],
      eliminate: [],
    }
  );
}

const USER_CACHE_TTL_MS = 5_000;
const DEFAULT_LABEL_COLOR = "#6366f1";
const supabase = createClient();

let cachedUser: User | null = null;
let hasCachedUser = false;
let cachedUserAt = 0;
let userInFlight: Promise<User | null> | null = null;
let ensuredDefaultsForUserId: string | null = null;
let ensureDefaultsInFlight: Promise<void> | null = null;

function getRowPriorityQuadrant(
  row: Pick<TodoRow | SubTodoRow, "priority" | "priority_quadrant">
): PriorityQuadrant {
  return normalizePriorityQuadrant(row.priority_quadrant ?? row.priority);
}

function getRowStatus(
  row: Pick<TodoRow | SubTodoRow, "status" | "is_completed">
): TodoStatus {
  if (isTodoStatus(row.status)) {
    return row.status;
  }

  if (typeof row.is_completed === "boolean") {
    return row.is_completed ? "DONE" : "TODO";
  }

  return "TODO";
}

function getRowWorkflowStatus(
  row: Pick<TodoRow | SubTodoRow, "workflow_status" | "status" | "is_completed">
): WorkflowStatus {
  const fallback = getRowStatus(row) === "DONE" ? "DONE" : "BACKLOG";
  return normalizeWorkflowStatus(row.workflow_status, fallback);
}

function getRowPayload(row: Pick<TodoRow | SubTodoRow, "payload">): TaskPayload | undefined {
  if (!row.payload || typeof row.payload !== "object") {
    return undefined;
  }
  return row.payload as TaskPayload;
}

function toTodoDoc(row: TodoRow): TodoDoc {
  const status = getRowStatus(row);
  const workflowStatus = getRowWorkflowStatus(row);

  return {
    _id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    labelId: row.label_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    story: row.story ?? undefined,
    dueDate: Number(row.due_date),
    priority: getRowPriorityQuadrant(row),
    status,
    workflowStatus,
    workload: row.workload ?? undefined,
    epicId: row.epic_id ?? undefined,
    personaId: row.persona_id ?? undefined,
    isCompleted: isDoneStatus(status),
    payload: getRowPayload(row),
    embedding: row.embedding ?? undefined,
  };
}

function toSubTodoDoc(row: SubTodoRow): SubTodoDoc {
  const status = getRowStatus(row);
  const workflowStatus = getRowWorkflowStatus(row);

  return {
    _id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    labelId: row.label_id,
    parentId: row.parent_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    story: row.story ?? undefined,
    dueDate: Number(row.due_date),
    priority: getRowPriorityQuadrant(row),
    status,
    workflowStatus,
    workload: row.workload ?? undefined,
    epicId: row.epic_id ?? undefined,
    personaId: row.persona_id ?? undefined,
    isCompleted: isDoneStatus(status),
    payload: getRowPayload(row),
    embedding: row.embedding ?? undefined,
  };
}

function toProjectDoc(row: ProjectRow): ProjectDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
  };
}

function toLabelDoc(row: LabelRow): LabelDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color?.trim() || DEFAULT_LABEL_COLOR,
    type: row.type,
  };
}

function toEpicDoc(row: EpicRow): EpicDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
  };
}

function toPersonaDoc(row: PersonaRow): PersonaDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    type: "user",
  };
}

function toUserFeatureSettingsDoc(
  row: UserFeatureSettingsRow
): UserFeatureSettingsDoc {
  const enabledModulesSource =
    row.enabled_modules && typeof row.enabled_modules === "object"
      ? (row.enabled_modules as Record<string, unknown>)
      : {};
  const locale = normalizeAppLocale(
    enabledModulesSource.locale,
    DEFAULT_APP_LOCALE
  );

  const taskPropertyVisibility =
    row.task_property_visibility &&
    typeof row.task_property_visibility === "object"
      ? Object.entries(row.task_property_visibility).reduce<
          Record<string, boolean>
        >((acc, [key, value]) => {
          if (typeof value === "boolean") {
            acc[key] = value;
          }
          return acc;
        }, {})
      : undefined;

  return {
    _id: row.user_id,
    userId: row.user_id,
    locale,
    enabledModules: normalizeTaskModuleFlags(enabledModulesSource),
    taskPropertyVisibility,
    sidebarModules: Array.isArray(row.sidebar_modules)
      ? row.sidebar_modules
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
  };
}

const V7_FALLBACK_ERROR_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "PGRST204", // missing column in schema cache
  "PGRST205", // missing table in schema cache
]);

const V7_FALLBACK_KEYWORDS = [
  "task_projections",
  "task_projection_positions",
  "task_relationships",
  "custom_field_definitions",
  "custom_field_values",
];

const LEGACY_PROJECTION_FALLBACKS: Array<
  Omit<TaskProjectionDoc, "_id" | "userId">
> = [
  {
    name: "List View",
    description: "Legacy fallback projection for list workflows.",
    projectionKind: "list",
    filters: {},
    sortRules: [],
    laneConfig: {},
    displayConfig: {},
    isDefault: true,
    isArchived: false,
    isVirtual: true,
  },
  {
    name: "Kanban View",
    description: "Legacy fallback projection for board workflows.",
    projectionKind: "kanban",
    filters: {},
    sortRules: [],
    laneConfig: {},
    displayConfig: {},
    isDefault: false,
    isArchived: false,
    isVirtual: true,
  },
  {
    name: "Eisenhower View",
    description: "Legacy fallback projection for matrix workflows.",
    projectionKind: "matrix",
    filters: {},
    sortRules: [],
    laneConfig: {},
    displayConfig: {},
    isDefault: false,
    isArchived: false,
    isVirtual: true,
  },
  {
    name: "Calendar View",
    description: "Legacy fallback projection for schedule workflows.",
    projectionKind: "calendar",
    filters: {},
    sortRules: [],
    laneConfig: {},
    displayConfig: {},
    isDefault: false,
    isArchived: false,
    isVirtual: true,
  },
];

type CustomFieldValueColumns = {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: number | null;
  value_json: unknown;
};

function toRecordValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toArrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toTaskRefOrNull({
  taskKind,
  todoId,
  subTodoId,
}: {
  taskKind: unknown;
  todoId: string | null;
  subTodoId: string | null;
}): TaskEntityRef | null {
  const normalizedTaskKind = normalizeTaskEntityKind(
    taskKind,
    todoId ? "todo" : "sub_todo"
  );

  if (normalizedTaskKind === "todo") {
    const taskId = todoId ?? subTodoId;
    return taskId
      ? {
          taskKind: "todo",
          taskId,
        }
      : null;
  }

  const taskId = subTodoId ?? todoId;
  return taskId
    ? {
        taskKind: "sub_todo",
        taskId,
      }
    : null;
}

function toTaskColumns(taskRef: TaskEntityRef) {
  if (taskRef.taskKind === "todo") {
    return {
      task_kind: "todo" as const,
      todo_id: taskRef.taskId,
      sub_todo_id: null,
    };
  }

  return {
    task_kind: "sub_todo" as const,
    todo_id: null,
    sub_todo_id: taskRef.taskId,
  };
}

function toTaskProjectionDoc(row: TaskProjectionRow): TaskProjectionDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    projectionKind: normalizeProjectionKind(row.projection_kind),
    filters: toRecordValue(row.filters),
    sortRules: toArrayValue(row.sort_rules),
    laneConfig: toRecordValue(row.lane_config),
    displayConfig: toRecordValue(row.display_config),
    isDefault: Boolean(row.is_default),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    isVirtual: false,
  };
}

function toTaskProjectionPositionDoc(
  row: TaskProjectionPositionRow
): TaskProjectionPositionDoc | null {
  const taskRef = toTaskRefOrNull({
    taskKind: row.task_kind,
    todoId: row.todo_id,
    subTodoId: row.sub_todo_id,
  });
  if (!taskRef) {
    return null;
  }

  return {
    _id: row.id,
    projectionId: row.projection_id,
    taskRef,
    laneKey: row.lane_key?.trim() || "default",
    lanePosition: Math.max(0, Math.trunc(toFiniteNumber(row.lane_position) ?? 0)),
    sortRank: toFiniteNumber(row.sort_rank) ?? 0,
    metadata: toRecordValue(row.metadata),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toTaskRelationshipDoc(row: TaskRelationshipRow): TaskRelationshipDoc | null {
  const source = toTaskRefOrNull({
    taskKind: row.source_kind,
    todoId: row.source_todo_id,
    subTodoId: row.source_sub_todo_id,
  });
  const target = toTaskRefOrNull({
    taskKind: row.target_kind,
    todoId: row.target_todo_id,
    subTodoId: row.target_sub_todo_id,
  });

  if (!source || !target) {
    return null;
  }

  return {
    _id: row.id,
    userId: row.user_id,
    relationKind: normalizeTaskRelationshipKind(row.relation_kind),
    source,
    target,
    metadata: toRecordValue(row.metadata),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toCustomFieldDefinitionDoc(
  row: CustomFieldDefinitionRow
): CustomFieldDefinitionDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    fieldKey: row.field_key,
    displayName: row.display_name,
    description: row.description ?? undefined,
    fieldType: normalizeCustomFieldType(row.field_type),
    appliesTo: normalizeCustomFieldAppliesTo(row.applies_to),
    options: toArrayValue(row.options),
    validation: toRecordValue(row.validation),
    isRequired: Boolean(row.is_required),
    isArchived: Boolean(row.is_archived),
    sortOrder: Math.trunc(toFiniteNumber(row.sort_order) ?? 0),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toCustomFieldValueDoc(row: CustomFieldValueRow): CustomFieldValueDoc | null {
  const taskRef = toTaskRefOrNull({
    taskKind: row.task_kind,
    todoId: row.todo_id,
    subTodoId: row.sub_todo_id,
  });
  if (!taskRef) {
    return null;
  }

  const valueNumber = toFiniteNumber(row.value_number);
  const valueDate = toFiniteNumber(row.value_date);

  return {
    _id: row.id,
    userId: row.user_id,
    fieldId: row.field_id,
    taskRef,
    valueText: row.value_text ?? undefined,
    valueNumber: valueNumber ?? undefined,
    valueBoolean:
      typeof row.value_boolean === "boolean" ? row.value_boolean : undefined,
    valueDate: valueDate ?? undefined,
    valueJson: row.value_json ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function getLegacyProjectionFallbacks(userId: string): TaskProjectionDoc[] {
  return LEGACY_PROJECTION_FALLBACKS.map((projection) => ({
    ...projection,
    _id: `legacy:${projection.projectionKind}`,
    userId,
  }));
}

function isV7FeatureUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const typedError = error as {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  };

  if (typedError.code && V7_FALLBACK_ERROR_CODES.has(typedError.code)) {
    return true;
  }

  const blob = [typedError.message, typedError.details, typedError.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!blob) {
    return false;
  }

  return V7_FALLBACK_KEYWORDS.some((keyword) => blob.includes(keyword));
}

function isMissingLabelColorColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const typedError = error as {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  };

  const blob = [typedError.message, typedError.details, typedError.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!blob) {
    return false;
  }

  return (
    typedError.code === "42703" &&
    blob.includes("color") &&
    (blob.includes("labels") || blob.includes("public.labels"))
  );
}

async function insertLabelWithOptionalColor({
  userId,
  name,
  color,
  type,
}: {
  userId: string;
  name: string;
  color: string;
  type: "user" | "system";
}) {
  const withColor = await supabase.from("labels").insert({
    user_id: userId,
    name,
    color,
    type,
  });

  if (!withColor.error) {
    return withColor;
  }

  if (!isMissingLabelColorColumnError(withColor.error)) {
    return withColor;
  }

  return supabase.from("labels").insert({
    user_id: userId,
    name,
    type,
  });
}

function getCustomFieldValueColumns({
  fieldType,
  value,
}: {
  fieldType: CustomFieldType;
  value: unknown;
}): CustomFieldValueColumns {
  const baseColumns: CustomFieldValueColumns = {
    value_text: null,
    value_number: null,
    value_boolean: null,
    value_date: null,
    value_json: null,
  };

  if (value === undefined || value === null || value === "") {
    return baseColumns;
  }

  if (fieldType === "text" || fieldType === "single_select") {
    baseColumns.value_text = String(value).trim();
    return baseColumns;
  }

  if (fieldType === "number") {
    const normalizedNumber = toFiniteNumber(value);
    if (normalizedNumber === null) {
      throw new Error("Custom field number value must be finite.");
    }
    baseColumns.value_number = normalizedNumber;
    return baseColumns;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") {
      baseColumns.value_boolean = value;
      return baseColumns;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();
      if (normalizedValue === "true") {
        baseColumns.value_boolean = true;
        return baseColumns;
      }
      if (normalizedValue === "false") {
        baseColumns.value_boolean = false;
        return baseColumns;
      }
    }

    throw new Error("Custom field boolean value must be true/false.");
  }

  if (fieldType === "date") {
    const normalizedDate = toFiniteNumber(value);
    if (normalizedDate === null) {
      throw new Error("Custom field date value must be a timestamp.");
    }
    baseColumns.value_date = Math.trunc(normalizedDate);
    return baseColumns;
  }

  if (fieldType === "multi_select") {
    baseColumns.value_json = Array.isArray(value)
      ? value.map((item) => String(item))
      : [String(value)];
    return baseColumns;
  }

  baseColumns.value_json = value;
  return baseColumns;
}

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
  hasCachedUser = true;
  cachedUserAt = Date.now();
});

async function resolveCurrentUser() {
  const now = Date.now();
  if (hasCachedUser && now - cachedUserAt < USER_CACHE_TTL_MS) {
    return cachedUser;
  }

  if (userInFlight) {
    return userInFlight;
  }

  userInFlight = (async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    cachedUser = session?.user ?? null;
    hasCachedUser = true;
    cachedUserAt = Date.now();
    return cachedUser;
  })();

  try {
    return await userInFlight;
  } finally {
    userInFlight = null;
  }
}

async function getSupabaseAndUser() {
  const user = await resolveCurrentUser();
  return { supabase, user };
}

async function ensureDefaultProjectAndLabel() {
  const { supabase, user } = await getSupabaseAndUser();
  if (!user) {
    return;
  }

  if (ensuredDefaultsForUserId === user.id) {
    return;
  }

  if (ensureDefaultsInFlight) {
    return ensureDefaultsInFlight;
  }

  ensureDefaultsInFlight = (async () => {
    const { data: existingSystemProjects, error: systemProjectsError } = await supabase
      .from("projects")
      .select("id")
      .eq("type", "system")
      .limit(1);
    if (systemProjectsError) throw systemProjectsError;

    let hasAccessibleProject = (existingSystemProjects?.length ?? 0) > 0;

    if (!hasAccessibleProject) {
      const { data: existingUserProjects, error: userProjectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (userProjectsError) throw userProjectsError;
      hasAccessibleProject = (existingUserProjects?.length ?? 0) > 0;
    }

    if (!hasAccessibleProject) {
      const { error: insertProjectError } = await supabase.from("projects").insert({
        user_id: user.id,
        name: "Inbox",
        type: "user",
      });
      if (insertProjectError) throw insertProjectError;
    }

    const { data: existingLabels, error: labelsError } = await supabase
      .from("labels")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    if (labelsError) throw labelsError;

    if (!existingLabels || existingLabels.length === 0) {
      const { error: insertLabelError } = await insertLabelWithOptionalColor({
        userId: user.id,
        name: "General",
        color: DEFAULT_LABEL_COLOR,
        type: "user",
      });
      if (insertLabelError) throw insertLabelError;
    }

    ensuredDefaultsForUserId = user.id;
  })();

  try {
    await ensureDefaultsInFlight;
  } finally {
    ensureDefaultsInFlight = null;
  }
}

function normalizeDueDateInput(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return Date.now();
}

async function resolveTaskContainerIds({
  userId,
  projectId,
  labelId,
}: {
  userId: string;
  projectId?: Id<"projects">;
  labelId?: Id<"labels">;
}) {
  await ensureDefaultProjectAndLabel();

  const selectedProjectId =
    typeof projectId === "string" ? projectId.trim() : "";
  const selectedLabelId = typeof labelId === "string" ? labelId.trim() : "";

  let resolvedProjectId: string | null = null;
  if (selectedProjectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,user_id,type")
      .eq("id", selectedProjectId)
      .maybeSingle();
    if (error) throw error;

    const row = data as ProjectRow | null;
    if (row && (row.type === "system" || row.user_id === userId)) {
      resolvedProjectId = row.id;
    }
  }

  if (!resolvedProjectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    resolvedProjectId = data?.id ?? null;
  }

  if (!resolvedProjectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("type", "system")
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    resolvedProjectId = data?.id ?? null;
  }

  let resolvedLabelId: string | null = null;
  if (selectedLabelId) {
    const { data, error } = await supabase
      .from("labels")
      .select("id,user_id,type")
      .eq("id", selectedLabelId)
      .maybeSingle();
    if (error) throw error;

    const row = data as LabelRow | null;
    if (row && (row.type === "system" || row.user_id === userId)) {
      resolvedLabelId = row.id;
    }
  }

  if (!resolvedLabelId) {
    const { data, error } = await supabase
      .from("labels")
      .select("id")
      .eq("user_id", userId)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    resolvedLabelId = data?.id ?? null;
  }

  if (!resolvedLabelId) {
    const { data, error } = await supabase
      .from("labels")
      .select("id")
      .eq("type", "system")
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    resolvedLabelId = data?.id ?? null;
  }

  if (!resolvedProjectId || !resolvedLabelId) {
    throw new Error("Default project/label is not ready yet. Please retry.");
  }

  return {
    projectId: resolvedProjectId as Id<"projects">,
    labelId: resolvedLabelId as Id<"labels">,
  };
}

async function ensureUserFeatureSettings() {
  const { supabase, user } = await getSupabaseAndUser();
  if (!user) return null;

  const { data: current, error: currentError } = await supabase
    .from("user_feature_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentError) throw currentError;
  if (current) {
    return current as UserFeatureSettingsRow;
  }

  const { data: created, error: createError } = await supabase
    .from("user_feature_settings")
    .insert({
      user_id: user.id,
      enabled_modules: {
        ...DEFAULT_TASK_MODULE_FLAGS,
        locale: DEFAULT_APP_LOCALE,
      },
      task_property_visibility: {
        persona: false,
        epic: false,
        name: true,
        description: true,
        story: false,
        priority: true,
        workload: false,
        dueDate: true,
        workflowStatus: false,
      },
      sidebar_modules: [],
    })
    .select("*")
    .single();

  if (createError) throw createError;
  return created as UserFeatureSettingsRow;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

async function listAllTodosForUser(userId: string) {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TodoRow[];
}

export type AiSuggestedReference =
  | {
      type: "existing";
      id: string;
      name: string;
    }
  | {
      type: "new";
      name: string;
    };

export type AiSuggestedTodo = {
  taskName: string;
  description: string | null;
  suggestedLabel: AiSuggestedReference;
  suggestedPersona?: AiSuggestedReference;
  suggestedEpic?: AiSuggestedReference;
  suggestedStory?: string;
  suggestedWorkload?: number;
};

export type AiSuggestionEnabledModules = {
  persona: boolean;
  epic: boolean;
  story: boolean;
  workload: boolean;
};

export type AiSuggestionsResponse = {
  created: number;
  autoCreated: boolean;
  enabledModules: AiSuggestionEnabledModules;
  recommendations: AiSuggestedTodo[];
};

export const api = {
  projects: {
    async getProjects() {
      await ensureDefaultProjectAndLabel();
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as ProjectDoc[];

      const { data: systemRows, error: systemError } = await supabase
        .from("projects")
        .select("*")
        .eq("type", "system")
        .order("name", { ascending: true });
      if (systemError) throw systemError;

      const { data: userRows, error: userError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (userError) throw userError;

      return [
        ...((systemRows ?? []) as ProjectRow[]).map(toProjectDoc),
        ...((userRows ?? []) as ProjectRow[]).map(toProjectDoc),
      ];
    },

    async getProjectByProjectId({ projectId }: { projectId: Id<"projects"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as ProjectRow;
      if (row.type === "system" || row.user_id === user.id) {
        return toProjectDoc(row);
      }
      return null;
    },

    async createAProject({ name }: { name: string }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name,
          type: "user",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id ?? null;
    },

    async updateAProject({
      projectId,
      name,
    }: {
      projectId: Id<"projects">;
      name: string;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const trimmedName = name.trim();
      if (!trimmedName) {
        return null;
      }

      const { data, error } = await supabase
        .from("projects")
        .update({ name: trimmedName })
        .eq("id", projectId)
        .eq("user_id", user.id)
        .eq("type", "user")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async deleteProject({ projectId }: { projectId: Id<"projects"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw projectError;
      if (!project) return null;

      const row = project as ProjectRow;
      if (row.type === "system" || row.user_id !== user.id) {
        return null;
      }

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId)
        .eq("user_id", user.id);
      if (error) throw error;
      return projectId;
    },

    async deleteProjectAndItsTasks({
      projectId,
    }: {
      projectId: Id<"projects">;
    }) {
      const deletedProjectId = await api.projects.deleteProject({ projectId });
      if (!deletedProjectId) {
        return { ok: false as const, reason: "Unable to delete project" };
      }
      return { ok: true as const, deletedTodos: 0 };
    },
  },

  labels: {
    async getLabels() {
      await ensureDefaultProjectAndLabel();
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as LabelDoc[];

      const { data: systemRows, error: systemError } = await supabase
        .from("labels")
        .select("*")
        .eq("type", "system")
        .order("name", { ascending: true });
      if (systemError) throw systemError;

      const { data: userRows, error: userError } = await supabase
        .from("labels")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (userError) throw userError;

      return [
        ...((systemRows ?? []) as LabelRow[]).map(toLabelDoc),
        ...((userRows ?? []) as LabelRow[]).map(toLabelDoc),
      ];
    },

    async getLabelByLabelId({ labelId }: { labelId: Id<"labels"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("labels")
        .select("*")
        .eq("id", labelId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as LabelRow;
      if (row.type === "system" || row.user_id === user.id) {
        return toLabelDoc(row);
      }
      return null;
    },

    async createALabel({
      name,
      color,
    }: {
      name: string;
      color?: string;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const trimmedName = name.trim();
      if (!trimmedName) {
        return null;
      }

      const desiredColor = color?.trim() || DEFAULT_LABEL_COLOR;

      const withColor = await supabase
        .from("labels")
        .insert({
          user_id: user.id,
          name: trimmedName,
          color: desiredColor,
          type: "user",
        })
        .select("id")
        .single();

      if (!withColor.error) {
        return withColor.data?.id ?? null;
      }

      if (!isMissingLabelColorColumnError(withColor.error)) {
        throw withColor.error;
      }

      const withoutColor = await supabase
        .from("labels")
        .insert({
          user_id: user.id,
          name: trimmedName,
          type: "user",
        })
        .select("id")
        .single();

      if (withoutColor.error) throw withoutColor.error;
      return withoutColor.data?.id ?? null;
    },

    async updateALabel({
      labelId,
      name,
      color,
    }: {
      labelId: Id<"labels">;
      name?: string;
      color?: string;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const updates: Record<string, unknown> = {};

      if (typeof name === "string" && name.trim()) {
        updates.name = name.trim();
      }

      if (typeof color === "string" && color.trim()) {
        updates.color = color.trim();
      }

      if (Object.keys(updates).length === 0) {
        return labelId;
      }

      const withColorUpdate = await supabase
        .from("labels")
        .update(updates)
        .eq("id", labelId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (!withColorUpdate.error) {
        return withColorUpdate.data?.id ?? null;
      }

      if (
        !isMissingLabelColorColumnError(withColorUpdate.error) ||
        !("color" in updates)
      ) {
        throw withColorUpdate.error;
      }

      const { color: _ignoredColor, ...updatesWithoutColor } = updates;
      if (Object.keys(updatesWithoutColor).length === 0) {
        return labelId;
      }

      const withoutColorUpdate = await supabase
        .from("labels")
        .update(updatesWithoutColor)
        .eq("id", labelId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (withoutColorUpdate.error) throw withoutColorUpdate.error;
      return withoutColorUpdate.data?.id ?? null;
    },
  },

  epics: {
    async getEpics() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as EpicDoc[];

      const { data, error } = await supabase
        .from("epics")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as EpicRow[]).map(toEpicDoc);
    },

    async createAnEpic({
      name,
      description,
    }: {
      name: string;
      description?: string;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("epics")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id ?? null;
    },
  },

  personas: {
    async getPersonas() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as PersonaDoc[];

      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as PersonaRow[]).map(toPersonaDoc);
    },

    async createAPersona({
      name,
      description,
    }: {
      name: string;
      description?: string;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const trimmedName = name.trim();
      if (!trimmedName) return null;

      const codeBase = slugify(trimmedName) || "persona";
      const randomSuffix = Math.random().toString(36).slice(2, 7);
      const code = `${codeBase}_${randomSuffix}`;

      const { data, error } = await supabase
        .from("personas")
        .insert({
          user_id: user.id,
          code,
          name: trimmedName,
          description: description?.trim() || null,
          type: "user",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id ?? null;
    },
  },

  userFeatureSettings: {
    async getMySettings() {
      const row = await ensureUserFeatureSettings();
      if (!row) return null;
      return toUserFeatureSettingsDoc(row);
    },

    async upsertMySettings({
      enabledModules,
      taskPropertyVisibility,
      sidebarModules,
      locale,
    }: {
      enabledModules?: Partial<TaskModuleFlags>;
      taskPropertyVisibility?: Record<string, boolean>;
      sidebarModules?: string[];
      locale?: AppLocale;
    }) {
      const existingRow = await ensureUserFeatureSettings();
      if (!existingRow) return null;

      const existingDoc = toUserFeatureSettingsDoc(existingRow);
      const mergedModules = normalizeTaskModuleFlags({
        ...existingDoc.enabledModules,
        ...(enabledModules ?? {}),
      });

      const mergedTaskPropertyVisibility = {
        ...(existingDoc.taskPropertyVisibility ?? {}),
        ...(taskPropertyVisibility ?? {}),
      };

      const nextSidebarModules =
        sidebarModules ??
        existingDoc.sidebarModules ??
        (mergedModules.persona ? ["personas"] : []);
      const nextLocale = normalizeAppLocale(
        locale,
        normalizeAppLocale(existingDoc.locale, DEFAULT_APP_LOCALE)
      );

      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_feature_settings")
        .update({
          enabled_modules: {
            ...mergedModules,
            locale: nextLocale,
          },
          task_property_visibility: mergedTaskPropertyVisibility,
          sidebar_modules: nextSidebarModules,
        })
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) throw error;
      return toUserFeatureSettingsDoc(data as UserFeatureSettingsRow);
    },
  },

  projections: {
    async getProjections({
      includeArchived = false,
    }: {
      includeArchived?: boolean;
    } = {}) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TaskProjectionDoc[];

      try {
        const baseQuery = supabase
          .from("task_projections")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("name", { ascending: true });

        const { data, error } = includeArchived
          ? await baseQuery
          : await baseQuery.eq("is_archived", false);

        if (error) throw error;

        const docs = ((data ?? []) as TaskProjectionRow[]).map(toTaskProjectionDoc);
        if (docs.length === 0) {
          return getLegacyProjectionFallbacks(user.id);
        }

        return docs;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return getLegacyProjectionFallbacks(user.id);
        }
        throw error;
      }
    },

    async createAProjection({
      name,
      description,
      projectionKind = "custom",
      filters = {},
      sortRules = [],
      laneConfig = {},
      displayConfig = {},
      isDefault = false,
    }: {
      name: string;
      description?: string;
      projectionKind?: ProjectionKind;
      filters?: Record<string, unknown>;
      sortRules?: unknown[];
      laneConfig?: Record<string, unknown>;
      displayConfig?: Record<string, unknown>;
      isDefault?: boolean;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const trimmedName = name.trim();
      if (!trimmedName) return null;

      try {
        if (isDefault) {
          const { error: resetDefaultError } = await supabase
            .from("task_projections")
            .update({ is_default: false })
            .eq("user_id", user.id);
          if (resetDefaultError) throw resetDefaultError;
        }

        const { data, error } = await supabase
          .from("task_projections")
          .insert({
            user_id: user.id,
            name: trimmedName,
            description: description?.trim() || null,
            projection_kind: normalizeProjectionKind(projectionKind, "custom"),
            filters: toRecordValue(filters),
            sort_rules: toArrayValue(sortRules),
            lane_config: toRecordValue(laneConfig),
            display_config: toRecordValue(displayConfig),
            is_default: isDefault,
          })
          .select("id")
          .single();

        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async updateAProjection({
      projectionId,
      name,
      description,
      projectionKind,
      filters,
      sortRules,
      laneConfig,
      displayConfig,
      isDefault,
      isArchived,
    }: {
      projectionId: Id<"taskProjections">;
      name?: string;
      description?: string;
      projectionKind?: ProjectionKind;
      filters?: Record<string, unknown>;
      sortRules?: unknown[];
      laneConfig?: Record<string, unknown>;
      displayConfig?: Record<string, unknown>;
      isDefault?: boolean;
      isArchived?: boolean;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;
      if (projectionId.startsWith("legacy:")) return null;

      const updates: Record<string, unknown> = {};

      if (typeof name === "string" && name.trim()) {
        updates.name = name.trim();
      }
      if (typeof description === "string") {
        updates.description = description.trim() || null;
      }
      if (projectionKind) {
        updates.projection_kind = normalizeProjectionKind(projectionKind, "custom");
      }
      if (filters) {
        updates.filters = toRecordValue(filters);
      }
      if (sortRules) {
        updates.sort_rules = toArrayValue(sortRules);
      }
      if (laneConfig) {
        updates.lane_config = toRecordValue(laneConfig);
      }
      if (displayConfig) {
        updates.display_config = toRecordValue(displayConfig);
      }
      if (typeof isDefault === "boolean") {
        updates.is_default = isDefault;
      }
      if (typeof isArchived === "boolean") {
        updates.is_archived = isArchived;
      }

      if (Object.keys(updates).length === 0) {
        return projectionId;
      }

      try {
        if (updates.is_default === true) {
          const { error: resetDefaultError } = await supabase
            .from("task_projections")
            .update({ is_default: false })
            .eq("user_id", user.id)
            .neq("id", projectionId);
          if (resetDefaultError) throw resetDefaultError;
        }

        const { data, error } = await supabase
          .from("task_projections")
          .update(updates)
          .eq("id", projectionId)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async deleteProjection({
      projectionId,
    }: {
      projectionId: Id<"taskProjections">;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;
      if (projectionId.startsWith("legacy:")) return null;

      try {
        const { error } = await supabase
          .from("task_projections")
          .delete()
          .eq("id", projectionId)
          .eq("user_id", user.id);
        if (error) throw error;
        return projectionId;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async getProjectionPositions({
      projectionId,
    }: {
      projectionId: Id<"taskProjections">;
    }) {
      if (projectionId.startsWith("legacy:")) {
        return [] as TaskProjectionPositionDoc[];
      }

      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TaskProjectionPositionDoc[];

      try {
        const { data, error } = await supabase
          .from("task_projection_positions")
          .select("*")
          .eq("projection_id", projectionId)
          .order("lane_key", { ascending: true })
          .order("lane_position", { ascending: true })
          .order("sort_rank", { ascending: true });
        if (error) throw error;

        return ((data ?? []) as TaskProjectionPositionRow[])
          .map(toTaskProjectionPositionDoc)
          .filter(
            (value): value is TaskProjectionPositionDoc => value !== null
          );
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return [] as TaskProjectionPositionDoc[];
        }
        throw error;
      }
    },

    async upsertProjectionPosition({
      projectionId,
      taskRef,
      laneKey = "default",
      lanePosition = 0,
      sortRank = 0,
      metadata = {},
    }: {
      projectionId: Id<"taskProjections">;
      taskRef: TaskEntityRef;
      laneKey?: string;
      lanePosition?: number;
      sortRank?: number;
      metadata?: Record<string, unknown>;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;
      if (projectionId.startsWith("legacy:")) return null;

      const taskColumns = toTaskColumns(taskRef);
      const taskIdColumn = taskRef.taskKind === "todo" ? "todo_id" : "sub_todo_id";
      const normalizedLaneKey = laneKey.trim() || "default";
      const normalizedLanePosition =
        Number.isFinite(lanePosition) && typeof lanePosition === "number"
          ? Math.max(0, Math.trunc(lanePosition))
          : 0;
      const normalizedSortRank =
        Number.isFinite(sortRank) && typeof sortRank === "number"
          ? sortRank
          : normalizedLanePosition;

      try {
        const { data: existing, error: existingError } = await supabase
          .from("task_projection_positions")
          .select("id")
          .eq("projection_id", projectionId)
          .eq("task_kind", taskColumns.task_kind)
          .eq(taskIdColumn, taskRef.taskId)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing?.id) {
          const { data, error } = await supabase
            .from("task_projection_positions")
            .update({
              lane_key: normalizedLaneKey,
              lane_position: normalizedLanePosition,
              sort_rank: normalizedSortRank,
              metadata: toRecordValue(metadata),
            })
            .eq("id", existing.id)
            .select("id")
            .single();
          if (error) throw error;
          return data?.id ?? null;
        }

        const { data, error } = await supabase
          .from("task_projection_positions")
          .insert({
            projection_id: projectionId,
            ...taskColumns,
            lane_key: normalizedLaneKey,
            lane_position: normalizedLanePosition,
            sort_rank: normalizedSortRank,
            metadata: toRecordValue(metadata),
          })
          .select("id")
          .single();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async moveTaskInProjection({
      projectionId,
      taskRef,
      destinationLaneKey,
      destinationLanePosition,
      destinationSortRank,
    }: {
      projectionId: Id<"taskProjections">;
      taskRef: TaskEntityRef;
      destinationLaneKey: string;
      destinationLanePosition: number;
      destinationSortRank?: number;
    }) {
      return api.projections.upsertProjectionPosition({
        projectionId,
        taskRef,
        laneKey: destinationLaneKey,
        lanePosition: destinationLanePosition,
        sortRank: destinationSortRank ?? destinationLanePosition,
      });
    },

    async upsertProjectionPositions({
      projectionId,
      positions,
    }: {
      projectionId: Id<"taskProjections">;
      positions: Array<{
        taskRef: TaskEntityRef;
        laneKey: string;
        lanePosition: number;
        sortRank?: number;
      }>;
    }) {
      const updates: string[] = [];
      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index];
        if (!position) {
          continue;
        }

        const id = await api.projections.upsertProjectionPosition({
          projectionId,
          taskRef: position.taskRef,
          laneKey: position.laneKey,
          lanePosition: position.lanePosition,
          sortRank: position.sortRank ?? position.lanePosition ?? index,
        });
        if (id) {
          updates.push(id);
        }
      }
      return updates;
    },

    async deleteProjectionPosition({
      projectionId,
      taskRef,
    }: {
      projectionId: Id<"taskProjections">;
      taskRef: TaskEntityRef;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;
      if (projectionId.startsWith("legacy:")) return null;

      const taskColumns = toTaskColumns(taskRef);
      const taskIdColumn = taskRef.taskKind === "todo" ? "todo_id" : "sub_todo_id";

      try {
        const { error } = await supabase
          .from("task_projection_positions")
          .delete()
          .eq("projection_id", projectionId)
          .eq("task_kind", taskColumns.task_kind)
          .eq(taskIdColumn, taskRef.taskId);
        if (error) throw error;
        return taskRef.taskId;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },
  },

  relationships: {
    async getTaskRelationships({
      taskRef,
    }: {
      taskRef: TaskEntityRef;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TaskRelationshipDoc[];

      const orFilter =
        taskRef.taskKind === "todo"
          ? `source_todo_id.eq.${taskRef.taskId},target_todo_id.eq.${taskRef.taskId}`
          : `source_sub_todo_id.eq.${taskRef.taskId},target_sub_todo_id.eq.${taskRef.taskId}`;

      try {
        const { data, error } = await supabase
          .from("task_relationships")
          .select("*")
          .eq("user_id", user.id)
          .or(orFilter)
          .order("created_at", { ascending: true });
        if (error) throw error;

        return ((data ?? []) as TaskRelationshipRow[])
          .map(toTaskRelationshipDoc)
          .filter((value): value is TaskRelationshipDoc => value !== null);
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return [] as TaskRelationshipDoc[];
        }
        throw error;
      }
    },

    async createATaskRelationship({
      relationKind = "depends_on",
      source,
      target,
      metadata = {},
    }: {
      relationKind?: TaskRelationshipKind;
      source: TaskEntityRef;
      target: TaskEntityRef;
      metadata?: Record<string, unknown>;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      if (source.taskKind === target.taskKind && source.taskId === target.taskId) {
        throw new Error("Cannot create relationship from a task to itself.");
      }

      const sourceColumns = toTaskColumns(source);
      const targetColumns = toTaskColumns(target);
      const sourceIdColumn =
        source.taskKind === "todo" ? "source_todo_id" : "source_sub_todo_id";
      const targetIdColumn =
        target.taskKind === "todo" ? "target_todo_id" : "target_sub_todo_id";
      const normalizedRelationKind = normalizeTaskRelationshipKind(relationKind);

      try {
        const { data: existing, error: existingError } = await supabase
          .from("task_relationships")
          .select("id")
          .eq("user_id", user.id)
          .eq("relation_kind", normalizedRelationKind)
          .eq("source_kind", sourceColumns.task_kind)
          .eq("target_kind", targetColumns.task_kind)
          .eq(sourceIdColumn, source.taskId)
          .eq(targetIdColumn, target.taskId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing?.id) {
          return existing.id;
        }

        const { data, error } = await supabase
          .from("task_relationships")
          .insert({
            user_id: user.id,
            relation_kind: normalizedRelationKind,
            source_kind: sourceColumns.task_kind,
            source_todo_id: source.taskKind === "todo" ? source.taskId : null,
            source_sub_todo_id:
              source.taskKind === "sub_todo" ? source.taskId : null,
            target_kind: targetColumns.task_kind,
            target_todo_id: target.taskKind === "todo" ? target.taskId : null,
            target_sub_todo_id:
              target.taskKind === "sub_todo" ? target.taskId : null,
            metadata: toRecordValue(metadata),
          })
          .select("id")
          .single();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async deleteTaskRelationship({
      relationshipId,
    }: {
      relationshipId: Id<"taskRelationships">;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      try {
        const { error } = await supabase
          .from("task_relationships")
          .delete()
          .eq("id", relationshipId)
          .eq("user_id", user.id);
        if (error) throw error;
        return relationshipId;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async deleteTaskRelationshipByEdge({
      relationKind = "depends_on",
      source,
      target,
    }: {
      relationKind?: TaskRelationshipKind;
      source: TaskEntityRef;
      target: TaskEntityRef;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const sourceIdColumn =
        source.taskKind === "todo" ? "source_todo_id" : "source_sub_todo_id";
      const targetIdColumn =
        target.taskKind === "todo" ? "target_todo_id" : "target_sub_todo_id";

      try {
        const { data, error } = await supabase
          .from("task_relationships")
          .delete()
          .eq("user_id", user.id)
          .eq("relation_kind", normalizeTaskRelationshipKind(relationKind))
          .eq("source_kind", source.taskKind)
          .eq("target_kind", target.taskKind)
          .eq(sourceIdColumn, source.taskId)
          .eq(targetIdColumn, target.taskId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },
  },

  customFields: {
    async getCustomFieldDefinitions({
      includeArchived = false,
      appliesTo,
    }: {
      includeArchived?: boolean;
      appliesTo?: CustomFieldAppliesTo;
    } = {}) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as CustomFieldDefinitionDoc[];

      try {
        let query = supabase
          .from("custom_field_definitions")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true })
          .order("display_name", { ascending: true });

        if (!includeArchived) {
          query = query.eq("is_archived", false);
        }

        const normalizedAppliesTo = appliesTo
          ? normalizeCustomFieldAppliesTo(appliesTo)
          : null;

        if (normalizedAppliesTo && normalizedAppliesTo !== "both") {
          query = query.in("applies_to", [normalizedAppliesTo, "both"]);
        } else if (normalizedAppliesTo === "both") {
          query = query.eq("applies_to", "both");
        }

        const { data, error } = await query;
        if (error) throw error;

        return ((data ?? []) as CustomFieldDefinitionRow[]).map(
          toCustomFieldDefinitionDoc
        );
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return [] as CustomFieldDefinitionDoc[];
        }
        throw error;
      }
    },

    async createACustomFieldDefinition({
      fieldKey,
      displayName,
      description,
      fieldType = "text",
      appliesTo = "both",
      options = [],
      validation = {},
      isRequired = false,
      sortOrder = 0,
    }: {
      fieldKey: string;
      displayName: string;
      description?: string;
      fieldType?: CustomFieldType;
      appliesTo?: CustomFieldAppliesTo;
      options?: unknown[];
      validation?: Record<string, unknown>;
      isRequired?: boolean;
      sortOrder?: number;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedFieldKey = normalizeCustomFieldKey(fieldKey);
      const normalizedDisplayName = displayName.trim();

      if (!normalizedFieldKey || !normalizedDisplayName) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from("custom_field_definitions")
          .insert({
            user_id: user.id,
            field_key: normalizedFieldKey,
            display_name: normalizedDisplayName,
            description: description?.trim() || null,
            field_type: normalizeCustomFieldType(fieldType, "text"),
            applies_to: normalizeCustomFieldAppliesTo(appliesTo, "both"),
            options: toArrayValue(options),
            validation: toRecordValue(validation),
            is_required: Boolean(isRequired),
            sort_order:
              Number.isFinite(sortOrder) && typeof sortOrder === "number"
                ? Math.trunc(sortOrder)
                : 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async updateCustomFieldDefinition({
      fieldId,
      fieldKey,
      displayName,
      description,
      fieldType,
      appliesTo,
      options,
      validation,
      isRequired,
      isArchived,
      sortOrder,
    }: {
      fieldId: Id<"customFieldDefinitions">;
      fieldKey?: string;
      displayName?: string;
      description?: string;
      fieldType?: CustomFieldType;
      appliesTo?: CustomFieldAppliesTo;
      options?: unknown[];
      validation?: Record<string, unknown>;
      isRequired?: boolean;
      isArchived?: boolean;
      sortOrder?: number;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const updates: Record<string, unknown> = {};

      if (typeof fieldKey === "string") {
        const normalizedFieldKey = normalizeCustomFieldKey(fieldKey);
        if (!normalizedFieldKey) return null;
        updates.field_key = normalizedFieldKey;
      }
      if (typeof displayName === "string" && displayName.trim()) {
        updates.display_name = displayName.trim();
      }
      if (typeof description === "string") {
        updates.description = description.trim() || null;
      }
      if (fieldType) {
        updates.field_type = normalizeCustomFieldType(fieldType, "text");
      }
      if (appliesTo) {
        updates.applies_to = normalizeCustomFieldAppliesTo(appliesTo, "both");
      }
      if (options) {
        updates.options = toArrayValue(options);
      }
      if (validation) {
        updates.validation = toRecordValue(validation);
      }
      if (typeof isRequired === "boolean") {
        updates.is_required = isRequired;
      }
      if (typeof isArchived === "boolean") {
        updates.is_archived = isArchived;
      }
      if (typeof sortOrder === "number" && Number.isFinite(sortOrder)) {
        updates.sort_order = Math.trunc(sortOrder);
      }

      if (Object.keys(updates).length === 0) {
        return fieldId;
      }

      try {
        const { data, error } = await supabase
          .from("custom_field_definitions")
          .update(updates)
          .eq("id", fieldId)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async deleteCustomFieldDefinition({
      fieldId,
    }: {
      fieldId: Id<"customFieldDefinitions">;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      try {
        const { error } = await supabase
          .from("custom_field_definitions")
          .delete()
          .eq("id", fieldId)
          .eq("user_id", user.id);
        if (error) throw error;
        return fieldId;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async getCustomFieldValuesForTask({
      taskRef,
    }: {
      taskRef: TaskEntityRef;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as CustomFieldValueDoc[];

      const taskIdColumn = taskRef.taskKind === "todo" ? "todo_id" : "sub_todo_id";

      try {
        const { data, error } = await supabase
          .from("custom_field_values")
          .select("*")
          .eq("user_id", user.id)
          .eq("task_kind", taskRef.taskKind)
          .eq(taskIdColumn, taskRef.taskId)
          .order("created_at", { ascending: true });
        if (error) throw error;

        return ((data ?? []) as CustomFieldValueRow[])
          .map(toCustomFieldValueDoc)
          .filter((value): value is CustomFieldValueDoc => value !== null);
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return [] as CustomFieldValueDoc[];
        }
        throw error;
      }
    },

    async upsertCustomFieldValue({
      fieldId,
      taskRef,
      value,
    }: {
      fieldId: Id<"customFieldDefinitions">;
      taskRef: TaskEntityRef;
      value: unknown;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      try {
        const { data: definitionRow, error: definitionError } = await supabase
          .from("custom_field_definitions")
          .select("field_type, applies_to")
          .eq("id", fieldId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (definitionError) throw definitionError;
        if (!definitionRow) return null;

        const definition = definitionRow as Pick<
          CustomFieldDefinitionRow,
          "field_type" | "applies_to"
        >;
        const normalizedAppliesTo = normalizeCustomFieldAppliesTo(
          definition.applies_to,
          "both"
        );

        if (
          normalizedAppliesTo !== "both" &&
          normalizedAppliesTo !== taskRef.taskKind
        ) {
          throw new Error(
            `Custom field does not apply to task kind: ${taskRef.taskKind}`
          );
        }

        const valueColumns = getCustomFieldValueColumns({
          fieldType: normalizeCustomFieldType(definition.field_type, "text"),
          value,
        });

        const hasValue =
          valueColumns.value_text !== null ||
          valueColumns.value_number !== null ||
          valueColumns.value_boolean !== null ||
          valueColumns.value_date !== null ||
          valueColumns.value_json !== null;

        const taskColumns = toTaskColumns(taskRef);
        const taskIdColumn = taskRef.taskKind === "todo" ? "todo_id" : "sub_todo_id";

        if (!hasValue) {
          const { error: deleteError } = await supabase
            .from("custom_field_values")
            .delete()
            .eq("field_id", fieldId)
            .eq("task_kind", taskColumns.task_kind)
            .eq(taskIdColumn, taskRef.taskId)
            .eq("user_id", user.id);
          if (deleteError) throw deleteError;
          return null;
        }

        const { data: existing, error: existingError } = await supabase
          .from("custom_field_values")
          .select("id")
          .eq("field_id", fieldId)
          .eq("task_kind", taskColumns.task_kind)
          .eq(taskIdColumn, taskRef.taskId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing?.id) {
          const { data, error } = await supabase
            .from("custom_field_values")
            .update(valueColumns)
            .eq("id", existing.id)
            .eq("user_id", user.id)
            .select("id")
            .single();
          if (error) throw error;
          return data?.id ?? null;
        }

        const { data, error } = await supabase
          .from("custom_field_values")
          .insert({
            user_id: user.id,
            field_id: fieldId,
            ...taskColumns,
            ...valueColumns,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data?.id ?? null;
      } catch (error) {
        if (isV7FeatureUnavailableError(error)) {
          return null;
        }
        throw error;
      }
    },

    async upsertCustomFieldValues({
      taskRef,
      values,
    }: {
      taskRef: TaskEntityRef;
      values: Array<{
        fieldId: Id<"customFieldDefinitions">;
        value: unknown;
      }>;
    }) {
      const updatedIds: string[] = [];
      for (const item of values) {
        const updatedId = await api.customFields.upsertCustomFieldValue({
          fieldId: item.fieldId,
          taskRef,
          value: item.value,
        });
        if (updatedId) {
          updatedIds.push(updatedId);
        }
      }
      return updatedIds;
    },
  },

  todos: {
    async get() {
      const { user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];
      const rows = await listAllTodosForUser(user.id);
      return rows.map(toTodoDoc);
    },

    async inCompleteTodosByEisenhowerQuadrant() {
      const inCompleteTodos = await api.todos.inCompleteTodos();
      return inCompleteTodos.reduce<EisenhowerTodos>((acc, todo) => {
        acc[todo.priority].push(todo);
        return acc;
      }, getEmptyQuadrants());
    },

    async getCompletedTodosByProjectId({
      projectId,
    }: {
      projectId: Id<"projects">;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("status", "DONE")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async getTodosByProjectId({ projectId }: { projectId: Id<"projects"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async getTodosByStatus({ status }: { status: TodoStatus }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const normalizedStatus = normalizeTodoStatus(status);
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", normalizedStatus)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async getInCompleteTodosByProjectId({
      projectId,
    }: {
      projectId: Id<"projects">;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .in("status", ["TODO", "IN_PROGRESS"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async getTodosTotalByProjectId({ projectId }: { projectId: Id<"projects"> }) {
      const completedTodos = await api.todos.getCompletedTodosByProjectId({
        projectId,
      });
      return completedTodos.length;
    },

    async todayTodos() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", start.getTime())
        .lte("due_date", end.getTime())
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async overdueTodos() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .lt("due_date", start.getTime())
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async completedTodos() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "DONE")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async inCompleteTodos() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as TodoDoc[];

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["TODO", "IN_PROGRESS"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TodoRow[]).map(toTodoDoc);
    },

    async totalTodos() {
      const completedTodos = await api.todos.completedTodos();
      return completedTodos.length;
    },

    async checkATodo({ taskId }: { taskId: Id<"todos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("todos")
        .update({
          status: "DONE",
          workflow_status: "DONE",
          is_completed: true,
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async unCheckATodo({ taskId }: { taskId: Id<"todos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("todos")
        .update({
          status: "TODO",
          workflow_status: "BACKLOG",
          is_completed: false,
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async updateTodoStatus({
      taskId,
      status,
      workflowStatus,
    }: {
      taskId: Id<"todos">;
      status: TodoStatus;
      workflowStatus?: WorkflowStatus;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedStatus = normalizeTodoStatus(status);
      const normalizedWorkflowStatus = workflowStatus
        ? normalizeWorkflowStatus(workflowStatus)
        : normalizedStatus === "DONE" ? "DONE" : "BACKLOG";
      const { data, error } = await supabase
        .from("todos")
        .update({
          status: normalizedStatus,
          workflow_status: normalizedWorkflowStatus,
          is_completed: isDoneStatus(normalizedStatus),
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async updateTodoPriority({
      taskId,
      priority,
    }: {
      taskId: Id<"todos">;
      priority: PriorityQuadrant;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedPriority = normalizePriorityQuadrant(priority);
      const { data, error } = await supabase
        .from("todos")
        .update({
          priority_quadrant: normalizedPriority,
          priority: QUADRANT_TO_LEGACY_PRIORITY[normalizedPriority],
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async updateATodoProjectAndLabel({
      taskId,
      projectId,
      labelId,
    }: {
      taskId: Id<"todos">;
      projectId?: Id<"projects">;
      labelId?: Id<"labels">;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const updates: Record<string, string> = {};

      if (typeof projectId === "string" && projectId.trim()) {
        const selectedProjectId = projectId.trim();
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id,user_id,type")
          .eq("id", selectedProjectId)
          .maybeSingle();
        if (projectError) throw projectError;

        const projectRow = project as ProjectRow | null;
        if (
          !projectRow ||
          (projectRow.type !== "system" && projectRow.user_id !== user.id)
        ) {
          return null;
        }

        updates.project_id = projectRow.id;
      }

      if (typeof labelId === "string" && labelId.trim()) {
        const selectedLabelId = labelId.trim();
        const { data: label, error: labelError } = await supabase
          .from("labels")
          .select("id,user_id,type")
          .eq("id", selectedLabelId)
          .maybeSingle();
        if (labelError) throw labelError;

        const labelRow = label as LabelRow | null;
        if (!labelRow || (labelRow.type !== "system" && labelRow.user_id !== user.id)) {
          return null;
        }

        updates.label_id = labelRow.id;
      }

      if (Object.keys(updates).length === 0) {
        return taskId;
      }

      const { data, error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async createATodo({
      taskName,
      description,
      story,
      priority,
      status,
      workflowStatus,
      workload,
      epicId,
      personaId,
      dueDate,
      projectId,
      labelId,
      payload,
      embedding,
    }: {
      taskName: string;
      description?: string;
      story?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      workflowStatus?: WorkflowStatus;
      workload?: number;
      epicId?: Id<"epics">;
      personaId?: Id<"personas">;
      dueDate?: number;
      projectId?: Id<"projects">;
      labelId?: Id<"labels">;
      payload?: TaskPayload;
      embedding?: number[];
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedPriority = normalizePriorityQuadrant(priority);
      const normalizedStatus = normalizeTodoStatus(status, "TODO");
      const normalizedWorkflowStatus = normalizeWorkflowStatus(
        workflowStatus,
        normalizedStatus === "DONE" ? "DONE" : "BACKLOG"
      );
      const normalizedWorkload =
        typeof workload === "number" && Number.isFinite(workload)
          ? Math.max(1, Math.min(100, Math.round(workload)))
          : null;
      const normalizedDueDate = normalizeDueDateInput(dueDate);
      const resolvedContainerIds = await resolveTaskContainerIds({
        userId: user.id,
        projectId,
        labelId,
      });

      const { data, error } = await supabase
        .from("todos")
        .insert({
          user_id: user.id,
          task_name: taskName,
          description: description ?? null,
          story: story ?? null,
          priority: QUADRANT_TO_LEGACY_PRIORITY[normalizedPriority],
          priority_quadrant: normalizedPriority,
          status: normalizedStatus,
          workflow_status: normalizedWorkflowStatus,
          workload: normalizedWorkload,
          epic_id: epicId ?? null,
          persona_id: personaId ?? null,
          due_date: normalizedDueDate,
          project_id: resolvedContainerIds.projectId,
          label_id: resolvedContainerIds.labelId,
          is_completed: isDoneStatus(normalizedStatus),
          payload: payload ?? {},
          embedding: embedding ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id ?? null;
    },

    async createTodoAndEmbeddings({
      taskName,
      description,
      story,
      priority,
      status,
      workflowStatus,
      workload,
      epicId,
      personaId,
      dueDate,
      projectId,
      labelId,
      payload,
    }: {
      taskName: string;
      description?: string;
      story?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      workflowStatus?: WorkflowStatus;
      workload?: number;
      epicId?: Id<"epics">;
      personaId?: Id<"personas">;
      dueDate?: number;
      projectId?: Id<"projects">;
      labelId?: Id<"labels">;
      payload?: TaskPayload;
    }) {
      return api.todos.createATodo({
        taskName,
        description,
        story,
        priority,
        status,
        workflowStatus,
        workload,
        epicId,
        personaId,
        dueDate,
        projectId,
        labelId,
        payload,
      });
    },

    async groupTodosByDate() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return {} as Record<string, TodoDoc[]>;

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .gt("due_date", Date.now())
        .order("due_date", { ascending: true });
      if (error) throw error;

      return ((data ?? []) as TodoRow[]).reduce<Record<string, TodoDoc[]>>(
        (acc, row) => {
          const todo = toTodoDoc(row);
          const key = new Date(todo.dueDate).toDateString();
          acc[key] = (acc[key] ?? []).concat(todo);
          return acc;
        },
        {}
      );
    },

    async deleteATodo({ taskId }: { taskId: Id<"todos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", taskId)
        .eq("user_id", user.id);
      if (error) throw error;
      return taskId;
    },
  },

  subTodos: {
    async get() {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as SubTodoDoc[];

      const { data, error } = await supabase
        .from("sub_todos")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as SubTodoRow[]).map(toSubTodoDoc);
    },

    async getSubTodosByParentId({ parentId }: { parentId: Id<"todos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as SubTodoDoc[];

      const { data, error } = await supabase
        .from("sub_todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("parent_id", parentId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as SubTodoRow[]).map(toSubTodoDoc);
    },

    async checkASubTodo({ taskId }: { taskId: Id<"subTodos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("sub_todos")
        .update({
          status: "DONE",
          workflow_status: "DONE",
          is_completed: true,
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async unCheckASubTodo({ taskId }: { taskId: Id<"subTodos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("sub_todos")
        .update({
          status: "TODO",
          workflow_status: "BACKLOG",
          is_completed: false,
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async createASubTodo({
      taskName,
      description,
      story,
      priority,
      status,
      workflowStatus,
      workload,
      epicId,
      personaId,
      dueDate,
      projectId,
      labelId,
      parentId,
      payload,
      embedding,
    }: {
      taskName: string;
      description?: string;
      story?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      workflowStatus?: WorkflowStatus;
      workload?: number;
      epicId?: Id<"epics">;
      personaId?: Id<"personas">;
      dueDate?: number;
      projectId?: Id<"projects">;
      labelId?: Id<"labels">;
      parentId: Id<"todos">;
      payload?: TaskPayload;
      embedding?: number[];
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedPriority = normalizePriorityQuadrant(priority);
      const normalizedStatus = normalizeTodoStatus(status, "TODO");
      const normalizedWorkflowStatus = normalizeWorkflowStatus(
        workflowStatus,
        normalizedStatus === "DONE" ? "DONE" : "BACKLOG"
      );
      const normalizedWorkload =
        typeof workload === "number" && Number.isFinite(workload)
          ? Math.max(1, Math.min(100, Math.round(workload)))
          : null;
      const normalizedDueDate = normalizeDueDateInput(dueDate);
      const resolvedContainerIds = await resolveTaskContainerIds({
        userId: user.id,
        projectId,
        labelId,
      });

      const { data, error } = await supabase
        .from("sub_todos")
        .insert({
          user_id: user.id,
          task_name: taskName,
          description: description ?? null,
          story: story ?? null,
          priority: QUADRANT_TO_LEGACY_PRIORITY[normalizedPriority],
          priority_quadrant: normalizedPriority,
          status: normalizedStatus,
          workflow_status: normalizedWorkflowStatus,
          workload: normalizedWorkload,
          epic_id: epicId ?? null,
          persona_id: personaId ?? null,
          due_date: normalizedDueDate,
          project_id: resolvedContainerIds.projectId,
          label_id: resolvedContainerIds.labelId,
          parent_id: parentId,
          is_completed: isDoneStatus(normalizedStatus),
          payload: payload ?? {},
          embedding: embedding ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id ?? null;
    },

    async createSubTodoAndEmbeddings({
      taskName,
      description,
      story,
      priority,
      status,
      workflowStatus,
      workload,
      epicId,
      personaId,
      dueDate,
      projectId,
      labelId,
      parentId,
      payload,
    }: {
      taskName: string;
      description?: string;
      story?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      workflowStatus?: WorkflowStatus;
      workload?: number;
      epicId?: Id<"epics">;
      personaId?: Id<"personas">;
      dueDate?: number;
      projectId?: Id<"projects">;
      labelId?: Id<"labels">;
      parentId: Id<"todos">;
      payload?: TaskPayload;
    }) {
      return api.subTodos.createASubTodo({
        taskName,
        description,
        story,
        priority,
        status,
        workflowStatus,
        workload,
        epicId,
        personaId,
        dueDate,
        projectId,
        labelId,
        parentId,
        payload,
      });
    },

    async completedSubTodos({ parentId }: { parentId: Id<"todos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as SubTodoDoc[];

      const { data, error } = await supabase
        .from("sub_todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("parent_id", parentId)
        .eq("status", "DONE")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as SubTodoRow[]).map(toSubTodoDoc);
    },

    async inCompleteSubTodos({ parentId }: { parentId: Id<"todos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return [] as SubTodoDoc[];

      const { data, error } = await supabase
        .from("sub_todos")
        .select("*")
        .eq("user_id", user.id)
        .eq("parent_id", parentId)
        .in("status", ["TODO", "IN_PROGRESS"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as SubTodoRow[]).map(toSubTodoDoc);
    },

    async deleteASubTodo({ taskId }: { taskId: Id<"subTodos"> }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { error } = await supabase
        .from("sub_todos")
        .delete()
        .eq("id", taskId)
        .eq("user_id", user.id);
      if (error) throw error;
      return taskId;
    },
  },

  search: {
    async searchTasks({ query }: { query: string }) {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return [] as TodoDoc[];
      }

      const todos = await api.todos.get();
      return todos.filter((todo) => {
        const task = todo.taskName.toLowerCase();
        const description = (todo.description ?? "").toLowerCase();
        return task.includes(normalizedQuery) || description.includes(normalizedQuery);
      });
    },
  },

  openai: {
    async suggestMissingItemsWithAi({
      projectId,
      autoCreate = true,
    }: {
      projectId: Id<"projects">;
      autoCreate?: boolean;
    }) {
      const response = await fetch("/api/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, autoCreate }),
      });
      if (!response.ok) {
        throw new Error("Failed to suggest tasks with AI");
      }
      return (await response.json()) as AiSuggestionsResponse;
    },

    async suggestMissingSubItemsWithAi({
      projectId,
      parentId,
      taskName,
      description,
      autoCreate = true,
    }: {
      projectId: Id<"projects">;
      parentId: Id<"todos">;
      taskName?: string;
      description?: string;
      autoCreate?: boolean;
    }) {
      const response = await fetch("/api/ai/suggest-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          parentId,
          taskName,
          description,
          autoCreate,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to suggest sub tasks with AI");
      }
      return (await response.json()) as AiSuggestionsResponse;
    },
  },
};
