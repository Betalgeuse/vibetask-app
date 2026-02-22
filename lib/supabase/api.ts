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
  DEFAULT_TASK_MODULE_FLAGS,
  normalizeWorkflowStatus,
  normalizeTaskModuleFlags,
  type TaskModuleFlags,
  type TaskPayload,
  type WorkflowStatus,
} from "@/lib/types/task-payload";
import {
  Doc,
  EpicDoc,
  Id,
  LabelDoc,
  PersonaDoc,
  ProjectDoc,
  SubTodoDoc,
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
    enabledModules: normalizeTaskModuleFlags(row.enabled_modules),
    taskPropertyVisibility,
    sidebarModules: Array.isArray(row.sidebar_modules)
      ? row.sidebar_modules
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
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
      enabled_modules: DEFAULT_TASK_MODULE_FLAGS,
      task_property_visibility: {
        persona: false,
        epic: false,
        name: true,
        description: true,
        story: false,
        priority: true,
        workload: false,
        dueDate: true,
        workflowStatus: true,
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
    }: {
      enabledModules?: Partial<TaskModuleFlags>;
      taskPropertyVisibility?: Record<string, boolean>;
      sidebarModules?: string[];
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

      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_feature_settings")
        .update({
          enabled_modules: mergedModules,
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
    }: {
      taskId: Id<"todos">;
      status: TodoStatus;
    }) {
      const { supabase, user } = await getSupabaseAndUser();
      if (!user) return null;

      const normalizedStatus = normalizeTodoStatus(status);
      const normalizedWorkflowStatus =
        normalizedStatus === "DONE" ? "DONE" : "BACKLOG";
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
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
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
          due_date: dueDate,
          project_id: projectId,
          label_id: labelId,
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
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
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
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
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
          due_date: dueDate,
          project_id: projectId,
          label_id: labelId,
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
      dueDate: number;
      projectId: Id<"projects">;
      labelId: Id<"labels">;
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
