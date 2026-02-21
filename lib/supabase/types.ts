import type { PriorityQuadrant, TodoStatus } from "@/lib/types/priority";

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
  type: LabelType;
}

export interface TodoDoc {
  _id: Id<"todos">;
  userId: string;
  projectId: Id<"projects">;
  labelId: Id<"labels">;
  taskName: string;
  description?: string;
  dueDate: number;
  priority: PriorityQuadrant;
  status: TodoStatus;
  isCompleted: boolean;
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
  dueDate: number;
  priority: PriorityQuadrant;
  status: TodoStatus;
  isCompleted: boolean;
  embedding?: number[];
}

interface DocMap {
  projects: ProjectDoc;
  labels: LabelDoc;
  todos: TodoDoc;
  subTodos: SubTodoDoc;
}

export type Doc<T extends keyof DocMap> = DocMap[T];

export type { PriorityQuadrant, TodoStatus } from "@/lib/types/priority";
