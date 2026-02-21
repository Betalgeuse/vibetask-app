export const PRIORITY_QUADRANTS = [
  "doFirst",
  "schedule",
  "delegate",
  "eliminate",
] as const;

export type PriorityQuadrant = (typeof PRIORITY_QUADRANTS)[number];

export const TODO_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export type LegacyPriority = 1 | 2 | 3 | 4;

export type PriorityQuadrantMeta = {
  key: PriorityQuadrant;
  title: string;
  subtitle: string;
  urgent: boolean;
  important: boolean;
  legacyPriority: LegacyPriority;
};

export const PRIORITY_QUADRANT_META: Record<
  PriorityQuadrant,
  PriorityQuadrantMeta
> = {
  doFirst: {
    key: "doFirst",
    title: "Do First",
    subtitle: "Urgent + Important",
    urgent: true,
    important: true,
    legacyPriority: 1,
  },
  schedule: {
    key: "schedule",
    title: "Schedule",
    subtitle: "Not Urgent + Important",
    urgent: false,
    important: true,
    legacyPriority: 2,
  },
  delegate: {
    key: "delegate",
    title: "Delegate",
    subtitle: "Urgent + Not Important",
    urgent: true,
    important: false,
    legacyPriority: 3,
  },
  eliminate: {
    key: "eliminate",
    title: "Eliminate",
    subtitle: "Not Urgent + Not Important",
    urgent: false,
    important: false,
    legacyPriority: 4,
  },
};

export const LEGACY_PRIORITY_TO_QUADRANT: Record<
  LegacyPriority,
  PriorityQuadrant
> = {
  1: "doFirst",
  2: "schedule",
  3: "delegate",
  4: "eliminate",
};

export const QUADRANT_TO_LEGACY_PRIORITY: Record<
  PriorityQuadrant,
  LegacyPriority
> = {
  doFirst: 1,
  schedule: 2,
  delegate: 3,
  eliminate: 4,
};

export function isPriorityQuadrant(value: unknown): value is PriorityQuadrant {
  return (
    typeof value === "string" &&
    PRIORITY_QUADRANTS.includes(value as PriorityQuadrant)
  );
}

export function isTodoStatus(value: unknown): value is TodoStatus {
  return (
    typeof value === "string" &&
    TODO_STATUSES.includes(value as TodoStatus)
  );
}

function parseLegacyPriority(value: unknown): LegacyPriority | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized >= 1 && normalized <= 4) {
      return normalized as LegacyPriority;
    }
  }

  if (typeof value === "string") {
    const normalized = Number.parseInt(value, 10);
    if (!Number.isNaN(normalized) && normalized >= 1 && normalized <= 4) {
      return normalized as LegacyPriority;
    }
  }

  return null;
}

export function normalizePriorityQuadrant(
  value: unknown,
  fallback: PriorityQuadrant = "doFirst"
): PriorityQuadrant {
  if (isPriorityQuadrant(value)) {
    return value;
  }

  const legacyPriority = parseLegacyPriority(value);
  if (legacyPriority !== null) {
    return LEGACY_PRIORITY_TO_QUADRANT[legacyPriority];
  }

  return fallback;
}

export function normalizeTodoStatus(
  value: unknown,
  fallback: TodoStatus = "TODO"
): TodoStatus {
  if (isTodoStatus(value)) {
    return value;
  }

  return fallback;
}

export function isDoneStatus(status: TodoStatus): boolean {
  return status === "DONE";
}
