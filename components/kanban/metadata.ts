import { Doc } from "@/lib/supabase/types";
import {
  PRIORITY_QUADRANTS,
  PRIORITY_QUADRANT_META,
  TODO_STATUSES,
  normalizePriorityQuadrant,
  normalizeTodoStatus,
  type PriorityQuadrant,
  type TodoStatus,
} from "@/lib/types/priority";

export type KanbanColumnKey = TodoStatus;
export type EisenhowerQuadrantKey = PriorityQuadrant;

type MetaItem<K extends string> = {
  key: K;
  title: string;
  subtitle: string;
};

const normalizeValue = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function buildAliasMap<K extends string>(aliases: Record<K, readonly string[]>) {
  const map = new Map<string, K>();

  (Object.keys(aliases) as Array<K>).forEach((key) => {
    map.set(normalizeValue(key), key);

    aliases[key].forEach((value) => {
      map.set(normalizeValue(value), key);
    });
  });

  return map;
}

const KANBAN_META_BY_STATUS: Record<KanbanColumnKey, Omit<MetaItem<KanbanColumnKey>, "key">> = {
  TODO: {
    title: "To Do",
    subtitle: "Planned tasks",
  },
  IN_PROGRESS: {
    title: "In Progress",
    subtitle: "Actively being worked",
  },
  DONE: {
    title: "Done",
    subtitle: "Completed tasks",
  },
};

export const KANBAN_COLUMN_META: Array<MetaItem<KanbanColumnKey>> = TODO_STATUSES.map(
  (status) => ({
    key: status,
    ...KANBAN_META_BY_STATUS[status],
  })
);

const KANBAN_ALIASES: Record<KanbanColumnKey, string[]> = {
  TODO: ["to do", "backlog", "open", "not started", "pending"],
  IN_PROGRESS: ["in progress", "doing", "active", "wip", "working"],
  DONE: ["completed", "complete", "closed", "finished"],
};

const KANBAN_ALIAS_MAP = buildAliasMap(KANBAN_ALIASES);

export const EISENHOWER_QUADRANT_META: Array<MetaItem<EisenhowerQuadrantKey>> =
  PRIORITY_QUADRANTS.map((quadrantKey) => ({
    key: quadrantKey,
    title: PRIORITY_QUADRANT_META[quadrantKey].title,
    subtitle: PRIORITY_QUADRANT_META[quadrantKey].subtitle,
  }));

const EISENHOWER_ALIASES: Record<EisenhowerQuadrantKey, string[]> = {
  doFirst: [
    "do first",
    "urgent important",
    "quadrant1",
    "q1",
    "important urgent",
  ],
  schedule: [
    "not urgent important",
    "quadrant2",
    "q2",
    "important not urgent",
  ],
  delegate: [
    "urgent not important",
    "quadrant3",
    "q3",
    "not important urgent",
  ],
  eliminate: [
    "not urgent not important",
    "quadrant4",
    "q4",
    "not important not urgent",
  ],
};

const EISENHOWER_ALIAS_MAP = buildAliasMap(EISENHOWER_ALIASES);

const INVALID_STATUS = "__invalid_status__" as TodoStatus;
const INVALID_QUADRANT = "__invalid_quadrant__" as PriorityQuadrant;

export const normalizeKanbanColumnKey = (value: unknown): KanbanColumnKey | null => {
  if (typeof value === "string") {
    const aliasMatch = KANBAN_ALIAS_MAP.get(normalizeValue(value));
    if (aliasMatch) {
      return aliasMatch;
    }
  }

  const normalizedStatus = normalizeTodoStatus(value, INVALID_STATUS);
  return normalizedStatus === INVALID_STATUS ? null : normalizedStatus;
};

export const normalizeEisenhowerQuadrantKey = (
  value: unknown
): EisenhowerQuadrantKey | null => {
  if (typeof value === "string") {
    const aliasMatch = EISENHOWER_ALIAS_MAP.get(normalizeValue(value));
    if (aliasMatch) {
      return aliasMatch;
    }
  }

  const normalizedQuadrant = normalizePriorityQuadrant(value, INVALID_QUADRANT);
  return normalizedQuadrant === INVALID_QUADRANT ? null : normalizedQuadrant;
};

type TodoWithMetadata = Doc<"todos"> &
  Partial<{
    status: string;
    kanbanStatus: string;
    kanban_status: string;
    workflowStatus: string;
    workflow_status: string;
    column: string;
    priority: string;
    priorityQuadrant: string;
    priority_quadrant: string;
    eisenhowerQuadrant: string;
    eisenhower_quadrant: string;
    quadrant: string;
    issueQuadrant: string;
    issue_quadrant: string;
  }>;

export const getTodoStoredKanbanColumn = (
  todo: Doc<"todos">
): KanbanColumnKey | null => {
  const todoWithMetadata = todo as TodoWithMetadata;

  return (
    normalizeKanbanColumnKey(todoWithMetadata.status) ??
    normalizeKanbanColumnKey(todoWithMetadata.kanbanStatus) ??
    normalizeKanbanColumnKey(todoWithMetadata.kanban_status) ??
    normalizeKanbanColumnKey(todoWithMetadata.workflowStatus) ??
    normalizeKanbanColumnKey(todoWithMetadata.workflow_status) ??
    normalizeKanbanColumnKey(todoWithMetadata.column)
  );
};

export const getTodoStoredEisenhowerQuadrant = (
  todo: Doc<"todos">
): EisenhowerQuadrantKey | null => {
  const todoWithMetadata = todo as TodoWithMetadata;

  return (
    normalizeEisenhowerQuadrantKey(todoWithMetadata.priority) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.priorityQuadrant) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.priority_quadrant) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.eisenhowerQuadrant) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.eisenhower_quadrant) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.quadrant) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.issueQuadrant) ??
    normalizeEisenhowerQuadrantKey(todoWithMetadata.issue_quadrant)
  );
};
