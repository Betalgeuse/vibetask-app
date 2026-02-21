"use client";

import { createClient } from "@/lib/supabase/client";
import { Doc, Id, LabelDoc, ProjectDoc, SubTodoDoc, TodoDoc } from "./types";
import type { User } from "@supabase/supabase-js";

type TodoRow = {
  id: string;
  user_id: string;
  project_id: string;
  label_id: string;
  task_name: string;
  description: string | null;
  due_date: number | string;
  priority: number | null;
  is_completed: boolean;
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
  due_date: number | string;
  priority: number | null;
  is_completed: boolean;
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

type EisenhowerQuadrant = "doFirst" | "schedule" | "delegate" | "eliminate";
type EisenhowerTodos = Record<EisenhowerQuadrant, Array<Doc<"todos">>>;

function getEmptyQuadrants(): EisenhowerTodos {
  return {
    doFirst: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };
}

const EISENHOWER_PRIORITY_IMPORTANT_MAX = 2;
const USER_CACHE_TTL_MS = 5_000;
const supabase = createClient();

let cachedUser: User | null = null;
let hasCachedUser = false;
let cachedUserAt = 0;
let userInFlight: Promise<User | null> | null = null;
let ensuredDefaultsForUserId: string | null = null;
let ensureDefaultsInFlight: Promise<void> | null = null;

function toTodoDoc(row: TodoRow): TodoDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    labelId: row.label_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    dueDate: Number(row.due_date),
    priority: row.priority ?? undefined,
    isCompleted: row.is_completed,
    embedding: row.embedding ?? undefined,
  };
}

function toSubTodoDoc(row: SubTodoRow): SubTodoDoc {
  return {
    _id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    labelId: row.label_id,
    parentId: row.parent_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    dueDate: Number(row.due_date),
    priority: row.priority ?? undefined,
    isCompleted: row.is_completed,
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

function isUrgent(todo: TodoDoc) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return todo.dueDate <= endOfToday.getTime();
}

function isImportant(todo: TodoDoc) {
  const normalizedPriority = todo.priority ?? 4;
  return normalizedPriority <= EISENHOWER_PRIORITY_IMPORTANT_MAX;
}

function getQuadrant(todo: TodoDoc): EisenhowerQuadrant {
  const urgent = isUrgent(todo);
  const important = isImportant(todo);

  if (urgent && important) return "doFirst";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "eliminate";
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
        acc[getQuadrant(todo)].push(todo);
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
        .eq("is_completed", true)
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
        .eq("is_completed", false)
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
        .eq("is_completed", true)
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
        .eq("is_completed", false)
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
        .update({ is_completed: true })
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
        .update({ is_completed: false })
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
      dueDate,
      projectId,
      labelId,
      embedding,
    }: {
      taskName: string;
      description?: string;
      priority: number;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
      embedding?: number[];
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("todos")
        .insert({
          user_id: user.id,
          task_name: taskName,
          description: description ?? null,
          priority,
          due_date: dueDate,
          project_id: projectId,
          label_id: labelId,
          is_completed: false,
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
      dueDate,
      projectId,
      labelId,
    }: {
      taskName: string;
      description?: string;
      priority: number;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
    }) {
      return api.todos.createATodo({
        taskName,
        description,
        priority,
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
        .update({ is_completed: true })
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
        .update({ is_completed: false })
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
      dueDate,
      projectId,
      labelId,
      parentId,
      embedding,
    }: {
      taskName: string;
      description?: string;
      priority: number;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
      parentId: Id<"todos">;
      embedding?: number[];
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("sub_todos")
        .insert({
          user_id: user.id,
          task_name: taskName,
          description: description ?? null,
          priority,
          due_date: dueDate,
          project_id: projectId,
          label_id: labelId,
          parent_id: parentId,
          is_completed: false,
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
      dueDate,
      projectId,
      labelId,
      parentId,
    }: {
      taskName: string;
      description?: string;
      priority: number;
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
      parentId: Id<"todos">;
    }) {
      return api.subTodos.createASubTodo({
        taskName,
        description,
        priority,
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
        .eq("is_completed", true)
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
        .eq("is_completed", false)
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
