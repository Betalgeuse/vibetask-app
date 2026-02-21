export const WORKFLOW_STATUSES = [
  "BACKLOG",
  "NEXT_WEEK",
  "THIS_WEEK",
  "TODAY",
  "DONE",
  "CANCEL",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const TASK_MODULE_KEYS = [
  "persona",
  "epic",
  "story",
  "workload",
  "workflowStatus",
  "calendarSync",
] as const;

export type TaskModuleKey = (typeof TASK_MODULE_KEYS)[number];
export type TaskModuleFlags = Record<TaskModuleKey, boolean>;

export const DEFAULT_TASK_MODULE_FLAGS: TaskModuleFlags = {
  persona: false,
  epic: false,
  story: true,
  workload: true,
  workflowStatus: true,
  calendarSync: false,
};

export type TaskPayload = {
  name?: string;
  description?: string;
  story?: string;
  epicId?: string;
  personaId?: string;
  workload?: number;
  dueDate?: number;
  priorityQuadrant?: string;
  workflowStatus?: WorkflowStatus;
  [key: string]: unknown;
};

export function normalizeTaskModuleFlags(value: unknown): TaskModuleFlags {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return TASK_MODULE_KEYS.reduce<TaskModuleFlags>((acc, key) => {
    acc[key] =
      typeof source[key] === "boolean"
        ? (source[key] as boolean)
        : DEFAULT_TASK_MODULE_FLAGS[key];
    return acc;
  }, { ...DEFAULT_TASK_MODULE_FLAGS });
}

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return (
    typeof value === "string" &&
    WORKFLOW_STATUSES.includes(value as WorkflowStatus)
  );
}

export function normalizeWorkflowStatus(
  value: unknown,
  fallback: WorkflowStatus = "BACKLOG"
): WorkflowStatus {
  if (!value) {
    return fallback;
  }

  if (isWorkflowStatus(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (isWorkflowStatus(normalized)) {
      return normalized;
    }
  }

  return fallback;
}
