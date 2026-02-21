"use client";

import { createClient } from "@/lib/supabase/client";
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
  normalizeWorkflowStatus,
  type TaskPayload,
  type WorkflowStatus,
} from "@/lib/types/task-payload";
import { Doc, Id, LabelDoc, ProjectDoc, SubTodoDoc, TodoDoc } from "./types";
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
  type: "user" | "system";
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
    type: row.type,
  };
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
    const { data: existingProjects, error: projectsError } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    if (projectsError) throw projectsError;

    if (!existingProjects || existingProjects.length === 0) {
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
      const { error: insertLabelError } = await supabase.from("labels").insert({
        user_id: user.id,
        name: "General",
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

    async createALabel({ name }: { name: string }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("labels")
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
    }: {
      taskId: Id<"todos">;
      status: TodoStatus;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedStatus = normalizeTodoStatus(status);
      const { data, error } = await supabase
        .from("todos")
        .update({
          status: normalizedStatus,
          is_completed: isDoneStatus(normalizedStatus),
        })
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
      priority,
      status,
      dueDate,
      projectId,
      labelId,
      embedding,
    }: {
      taskName: string;
      description?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
      embedding?: number[];
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedPriority = normalizePriorityQuadrant(priority);
      const normalizedStatus = normalizeTodoStatus(status, "TODO");

      const { data, error } = await supabase
        .from("todos")
        .insert({
          user_id: user.id,
          task_name: taskName,
          description: description ?? null,
          priority: QUADRANT_TO_LEGACY_PRIORITY[normalizedPriority],
          priority_quadrant: normalizedPriority,
          status: normalizedStatus,
          due_date: dueDate,
          project_id: projectId,
          label_id: labelId,
          is_completed: isDoneStatus(normalizedStatus),
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
      priority,
      status,
      dueDate,
      projectId,
      labelId,
    }: {
      taskName: string;
      description?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
    }) {
      return api.todos.createATodo({
        taskName,
        description,
        priority,
        status,
        dueDate,
        projectId,
        labelId,
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
      priority,
      status,
      dueDate,
      projectId,
      labelId,
      parentId,
      embedding,
    }: {
      taskName: string;
      description?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
      parentId: Id<"todos">;
      embedding?: number[];
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedPriority = normalizePriorityQuadrant(priority);
      const normalizedStatus = normalizeTodoStatus(status, "TODO");

      const { data, error } = await supabase
        .from("sub_todos")
        .insert({
          user_id: user.id,
          task_name: taskName,
          description: description ?? null,
          priority: QUADRANT_TO_LEGACY_PRIORITY[normalizedPriority],
          priority_quadrant: normalizedPriority,
          status: normalizedStatus,
          due_date: dueDate,
          project_id: projectId,
          label_id: labelId,
          parent_id: parentId,
          is_completed: isDoneStatus(normalizedStatus),
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
      priority,
      status,
      dueDate,
      projectId,
      labelId,
      parentId,
    }: {
      taskName: string;
      description?: string;
      priority: PriorityQuadrant | number;
      status?: TodoStatus;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
      parentId: Id<"todos">;
    }) {
      return api.subTodos.createASubTodo({
        taskName,
        description,
        priority,
        status,
        dueDate,
        projectId,
        labelId,
        parentId,
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
    async suggestMissingItemsWithAi({ projectId }: { projectId: Id<"projects"> }) {
      const response = await fetch("/api/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        throw new Error("Failed to suggest tasks with AI");
      }
      return response.json();
    },

    async suggestMissingSubItemsWithAi({
      projectId,
      parentId,
      taskName,
      description,
    }: {
      projectId: Id<"projects">;
      parentId: Id<"todos">;
      taskName: string;
      description: string;
    }) {
      const response = await fetch("/api/ai/suggest-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          parentId,
          taskName,
          description,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to suggest sub tasks with AI");
      }
      return response.json();
    },
  },
};
