import type { PriorityQuadrant, TodoStatus } from "@/lib/types/priority";
import type {
  TaskModuleFlags,
  TaskPayload,
  WorkflowStatus,
} from "@/lib/types/task-payload";
import type {
  CustomFieldAppliesTo,
  CustomFieldType,
  ProjectionKind,
  TaskEntityRef,
  TaskRelationshipKind,
} from "@/lib/types/task-projection";

export type Id<_TableName extends string = string> = string;

export type ProjectType = "user" | "system";
export type LabelType = "user" | "system";

export interface ProjectDoc {
  _id: Id<"projects">;
  userId: string | null;
  name: string;
  type: ProjectType;
}

export interface LabelDoc {
  _id: Id<"labels">;
  userId: string | null;
  name: string;
  color: string;
  type: LabelType;
}

export interface TodoDoc {
  _id: Id<"todos">;
  userId: string;
  projectId: Id<"projects">;
  labelId: Id<"labels">;
  taskName: string;
  description?: string;
  story?: string;
  dueDate: number;
  priority: PriorityQuadrant;
  status: TodoStatus;
  workflowStatus?: WorkflowStatus;
  workload?: number;
  epicId?: Id<"epics">;
  personaId?: Id<"personas">;
  isCompleted: boolean;
  payload?: TaskPayload;
  embedding?: number[];
}

export interface SubTodoDoc {
  _id: Id<"subTodos">;
  userId: string;
  projectId: Id<"projects">;
  labelId: Id<"labels">;
  parentId: Id<"todos">;
  taskName: string;
  description?: string;
  story?: string;
  dueDate: number;
  priority: PriorityQuadrant;
  status: TodoStatus;
  workflowStatus?: WorkflowStatus;
  workload?: number;
  epicId?: Id<"epics">;
  personaId?: Id<"personas">;
  isCompleted: boolean;
  payload?: TaskPayload;
  embedding?: number[];
}

export interface EpicDoc {
  _id: Id<"epics">;
  userId: string;
  name: string;
  description?: string;
}

export interface PersonaDoc {
  _id: Id<"personas">;
  userId: string | null;
  code: string;
  name: string;
  description?: string;
  type: "system" | "user";
}

export interface UserFeatureSettingsDoc {
  _id: Id<"userFeatureSettings">;
  userId: string;
  enabledModules: TaskModuleFlags;
  taskPropertyVisibility?: Record<string, boolean>;
  sidebarModules?: string[];
}

export interface TaskProjectionDoc {
  _id: Id<"taskProjections">;
  userId: string;
  name: string;
  description?: string;
  projectionKind: ProjectionKind;
  filters: Record<string, unknown>;
  sortRules: unknown[];
  laneConfig: Record<string, unknown>;
  displayConfig: Record<string, unknown>;
  isDefault: boolean;
  isArchived: boolean;
  createdAt?: string;
  updatedAt?: string;
  isVirtual?: boolean;
}

export interface TaskProjectionPositionDoc {
  _id: Id<"taskProjectionPositions">;
  projectionId: Id<"taskProjections">;
  taskRef: TaskEntityRef;
  laneKey: string;
  lanePosition: number;
  sortRank: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskRelationshipDoc {
  _id: Id<"taskRelationships">;
  userId: string;
  relationKind: TaskRelationshipKind;
  source: TaskEntityRef;
  target: TaskEntityRef;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomFieldDefinitionDoc {
  _id: Id<"customFieldDefinitions">;
  userId: string;
  fieldKey: string;
  displayName: string;
  description?: string;
  fieldType: CustomFieldType;
  appliesTo: CustomFieldAppliesTo;
  options: unknown[];
  validation: Record<string, unknown>;
  isRequired: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomFieldValueDoc {
  _id: Id<"customFieldValues">;
  userId: string;
  fieldId: Id<"customFieldDefinitions">;
  taskRef: TaskEntityRef;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: number;
  valueJson?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

interface DocMap {
  projects: ProjectDoc;
  labels: LabelDoc;
  todos: TodoDoc;
  subTodos: SubTodoDoc;
  epics: EpicDoc;
  personas: PersonaDoc;
  userFeatureSettings: UserFeatureSettingsDoc;
  taskProjections: TaskProjectionDoc;
  taskProjectionPositions: TaskProjectionPositionDoc;
  taskRelationships: TaskRelationshipDoc;
  customFieldDefinitions: CustomFieldDefinitionDoc;
  customFieldValues: CustomFieldValueDoc;
}

export type Doc<T extends keyof DocMap> = DocMap[T];

export type { PriorityQuadrant, TodoStatus } from "@/lib/types/priority";
export type {
  WorkflowStatus,
  TaskPayload,
  TaskModuleFlags,
} from "@/lib/types/task-payload";
export type {
  ProjectionKind,
  TaskEntityKind,
  TaskEntityRef,
  TaskRelationshipKind,
  CustomFieldType,
  CustomFieldAppliesTo,
} from "@/lib/types/task-projection";
