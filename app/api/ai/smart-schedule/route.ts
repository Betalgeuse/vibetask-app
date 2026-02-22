import {
  fetchGoogleCalendarEvents,
  refreshGoogleCalendarAccessToken,
  type CalendarEvent,
} from "@/lib/google/calendar-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY;
const usingGemini = Boolean(geminiApiKey);
const resolvedApiKey = geminiApiKey ?? openAiApiKey ?? null;

const openai = resolvedApiKey
  ? new OpenAI({
      apiKey: resolvedApiKey,
      ...(usingGemini
        ? { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai" }
        : {}),
    })
  : null;

const CHAT_MODEL = usingGemini ? "gemini-2.0-flash" : "gpt-3.5-turbo";

type CalendarTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type TodoRow = {
  id: string;
  task_name: string;
  description: string | null;
  due_date: number | string | null;
  workload: number | null;
  priority_quadrant: string | null;
  priority: string | number | null;
  status: string | null;
};

type TodoCandidate = {
  id: string;
  taskName: string;
  description: string | null;
  dueDate: number | null;
  workload: number | null;
  priority: string | null;
  status: string | null;
};

type SmartScheduleBlock = {
  type: "calendar" | "focus";
  time: string;
  title?: string;
  tasks?: string[];
  note?: string;
  startMinute?: number;
};

type SmartScheduleRequest = {
  date?: string;
};

type SmartScheduleResponse = {
  date: string;
  source: "ai" | "fallback";
  connectedCalendar: boolean;
  schedule: SmartScheduleBlock[];
  stats: {
    events: number;
    todos: number;
  };
  warning?: string;
};

function isRelationMissingError(error: unknown, relation: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";

  return code === "42P01" || message.includes(relation.toLowerCase());
}

function needsRefresh(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) {
    return false;
  }

  return expiry <= Date.now() + 30_000;
}

function toExpiresAt(expiresIn?: number) {
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn)) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function getTargetDate(input?: string) {
  if (typeof input !== "string" || !input.trim()) {
    return new Date();
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getDayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function minuteToTimeLabel(totalMinutes: number) {
  const normalized = Math.max(0, Math.min(24 * 60, Math.floor(totalMinutes)));
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function minuteRangeLabel(startMinute: number, endMinute: number) {
  return `${minuteToTimeLabel(startMinute)}-${minuteToTimeLabel(endMinute)}`;
}

function toMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function estimateTaskMinutes(todo: TodoCandidate) {
  const workload = todo.workload ?? null;
  if (typeof workload === "number" && Number.isFinite(workload)) {
    return Math.max(30, Math.min(120, Math.round(workload * 1.2)));
  }

  const priority = todo.priority?.toLowerCase() ?? "";
  if (priority.includes("dofirst")) {
    return 90;
  }
  if (priority.includes("delegate") || priority.includes("eliminate")) {
    return 45;
  }

  return 60;
}

function toEventInterval(
  event: CalendarEvent,
  dayStartMs: number,
  dayEndMs: number
): { startMinute: number; endMinute: number } | null {
  if (event.allDay) {
    return {
      startMinute: 9 * 60,
      endMinute: 18 * 60,
    };
  }

  if (!event.start || !event.end) {
    return null;
  }

  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  const clampedStart = Math.max(start, dayStartMs);
  const clampedEnd = Math.min(end, dayEndMs);
  if (clampedEnd <= clampedStart) {
    return null;
  }

  const startMinute = toMinuteOfDay(new Date(clampedStart));
  const endMinute = toMinuteOfDay(new Date(clampedEnd));

  if (endMinute <= startMinute) {
    return null;
  }

  return {
    startMinute,
    endMinute,
  };
}

function mergeIntervals(
  intervals: Array<{ startMinute: number; endMinute: number }>
): Array<{ startMinute: number; endMinute: number }> {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute);
  const merged: Array<{ startMinute: number; endMinute: number }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, current.endMinute);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function getFallbackSchedule(params: {
  events: CalendarEvent[];
  todos: TodoCandidate[];
  dayStart: Date;
  dayEnd: Date;
}) {
  const workStartMinute = 9 * 60;
  const workEndMinute = 18 * 60;
  const dayStartMs = params.dayStart.getTime();
  const dayEndMs = params.dayEnd.getTime();

  const busyIntervals = params.events
    .map((event) => toEventInterval(event, dayStartMs, dayEndMs))
    .filter((interval): interval is { startMinute: number; endMinute: number } =>
      Boolean(interval)
    );

  busyIntervals.push({ startMinute: 12 * 60, endMinute: 13 * 60 });

  const mergedBusy = mergeIntervals(busyIntervals)
    .map((interval) => ({
      startMinute: Math.max(workStartMinute, interval.startMinute),
      endMinute: Math.min(workEndMinute, interval.endMinute),
    }))
    .filter((interval) => interval.endMinute > interval.startMinute);

  const freeIntervals: Array<{ startMinute: number; endMinute: number }> = [];
  let cursor = workStartMinute;

  mergedBusy.forEach((interval) => {
    if (interval.startMinute > cursor) {
      freeIntervals.push({ startMinute: cursor, endMinute: interval.startMinute });
    }
    cursor = Math.max(cursor, interval.endMinute);
  });

  if (cursor < workEndMinute) {
    freeIntervals.push({ startMinute: cursor, endMinute: workEndMinute });
  }

  const blocks: SmartScheduleBlock[] = [];

  params.events.forEach((event) => {
    const startMinute = event.start ? toMinuteOfDay(new Date(event.start)) : undefined;
    const endMinute = event.end ? toMinuteOfDay(new Date(event.end)) : undefined;

    blocks.push({
      type: "calendar",
      time:
        typeof startMinute === "number" && typeof endMinute === "number"
          ? minuteRangeLabel(startMinute, endMinute)
          : event.allDay
            ? "All day"
            : "Time TBD",
      title: event.summary,
      note: event.location ?? undefined,
      startMinute: typeof startMinute === "number" ? startMinute : undefined,
    });
  });

  const queue = [...params.todos];

  freeIntervals.forEach((slot) => {
    if (queue.length === 0) {
      return;
    }

    let slotCursor = slot.startMinute;
    const slotTasks: string[] = [];

    while (queue.length > 0) {
      const next = queue[0];
      const taskMinutes = estimateTaskMinutes(next);
      const nextEnd = slotCursor + taskMinutes;
      if (nextEnd > slot.endMinute) {
        break;
      }

      slotTasks.push(next.taskName);
      queue.shift();
      slotCursor = nextEnd + 10;

      if (slotTasks.length >= 2) {
        break;
      }
    }

    if (slotTasks.length > 0) {
      blocks.push({
        type: "focus",
        time: minuteRangeLabel(slot.startMinute, Math.min(slotCursor, slot.endMinute)),
        tasks: slotTasks,
        note: "Suggested deep-work block.",
        startMinute: slot.startMinute,
      });
    }
  });

  if (queue.length > 0) {
    blocks.push({
      type: "focus",
      time: "Later",
      tasks: queue.slice(0, 3).map((todo) => todo.taskName),
      note: "Not enough free time in the current workday window.",
      startMinute: 24 * 60,
    });
  }

  return blocks.sort((left, right) => {
    const leftMinute = typeof left.startMinute === "number" ? left.startMinute : Number.MAX_SAFE_INTEGER;
    const rightMinute =
      typeof right.startMinute === "number" ? right.startMinute : Number.MAX_SAFE_INTEGER;
    return leftMinute - rightMinute;
  });
}

function normalizeScheduleItems(value: unknown): SmartScheduleBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: SmartScheduleBlock[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const record = item as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type.toLowerCase() : "focus";
    const time = typeof record.time === "string" ? record.time.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const tasks = Array.isArray(record.tasks)
      ? record.tasks
          .map((task) => (typeof task === "string" ? task.trim() : ""))
          .filter((task) => Boolean(task))
      : [];
    const note = typeof record.note === "string" ? record.note.trim() : "";

    if (!time) {
      return;
    }

    if (type === "calendar") {
      normalized.push({
        type: "calendar",
        time,
        title: title || "Calendar event",
        note: note || undefined,
      });
      return;
    }

    if (tasks.length === 0 && !title) {
      return;
    }

    normalized.push({
      type: "focus",
      time,
      tasks: tasks.length > 0 ? tasks : [title],
      note: note || undefined,
    });
  });

  return normalized;
}

async function tryAiSchedule(params: {
  date: string;
  events: CalendarEvent[];
  todos: TodoCandidate[];
  fallbackSchedule: SmartScheduleBlock[];
}) {
  if (!openai || !resolvedApiKey) {
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a productivity scheduling assistant. Return strict JSON object with key schedule (array). Each item must include: type (calendar or focus), time (HH:mm-HH:mm or label), and either title (for calendar) or tasks (string array for focus). Keep output practical and concise.",
      },
      {
        role: "user",
        content: JSON.stringify({
          date: params.date,
          calendarEvents: params.events.map((event) => ({
            summary: event.summary,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            location: event.location,
          })),
          todos: params.todos.map((todo) => ({
            taskName: todo.taskName,
            dueDate: todo.dueDate,
            workload: todo.workload,
            priority: todo.priority,
          })),
          fallbackSchedule: params.fallbackSchedule.map((block) => ({
            type: block.type,
            time: block.time,
            title: block.title,
            tasks: block.tasks,
            note: block.note,
          })),
          schedulingRules: [
            "Avoid lunch break 12:00-13:00 when suggesting focus blocks.",
            "Prefer 1-2 tasks per focus block.",
            "Use calendar type for fixed events and focus type for task blocks.",
          ],
        }),
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content ?? null;
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as { schedule?: unknown };
  const normalized = normalizeScheduleItems(parsed.schedule);
  return normalized.length > 0 ? normalized : null;
}

async function readTodayTodos(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("todos")
    .select("id,task_name,description,due_date,workload,priority_quadrant,priority,status")
    .eq("user_id", userId)
    .in("status", ["TODO", "IN_PROGRESS"])
    .order("due_date", { ascending: true })
    .limit(30);

  if (error) {
    throw new Error("Failed to read todos for smart schedule.");
  }

  return ((data ?? []) as TodoRow[]).map((row) => ({
    id: row.id,
    taskName: row.task_name,
    description: row.description ?? null,
    dueDate:
      typeof row.due_date === "number"
        ? row.due_date
        : typeof row.due_date === "string"
          ? Number.parseInt(row.due_date, 10) || null
          : null,
    workload:
      typeof row.workload === "number" && Number.isFinite(row.workload) ? row.workload : null,
    priority:
      (typeof row.priority_quadrant === "string" && row.priority_quadrant) ||
      (typeof row.priority === "string" ? row.priority : null),
    status: row.status,
  }));
}

async function readCalendarEvents(params: {
  userId: string;
  timeMin: string;
  timeMax: string;
}) {
  const supabase = createClient();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("user_calendar_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (tokenError) {
    if (isRelationMissingError(tokenError, "user_calendar_tokens")) {
      return {
        connected: false,
        warning: "Calendar token table is missing. Apply v8 migration first.",
        events: [] as CalendarEvent[],
      };
    }

    return {
      connected: false,
      warning: "Failed to read calendar token.",
      events: [] as CalendarEvent[],
    };
  }

  const tokens = tokenRow as CalendarTokenRow | null;
  if (!tokens?.access_token && !tokens?.refresh_token) {
    return {
      connected: false,
      warning: undefined,
      events: [] as CalendarEvent[],
    };
  }

  let accessToken = tokens?.access_token ?? null;
  const refreshToken = tokens?.refresh_token ?? null;

  if ((!accessToken || needsRefresh(tokens?.expires_at ?? null)) && refreshToken) {
    try {
      const refreshed = await refreshGoogleCalendarAccessToken({ refreshToken });
      accessToken = refreshed.accessToken;

      const { error: updateError } = await supabase
        .from("user_calendar_tokens")
        .update({
          access_token: refreshed.accessToken,
          token_type: refreshed.tokenType ?? null,
          scope: refreshed.scope ?? null,
          expires_at: toExpiresAt(refreshed.expiresIn),
        })
        .eq("user_id", params.userId);

      if (updateError && !isRelationMissingError(updateError, "user_calendar_tokens")) {
        return {
          connected: false,
          warning: "Failed to persist refreshed calendar token.",
          events: [] as CalendarEvent[],
        };
      }
    } catch (error) {
      return {
        connected: false,
        warning:
          error instanceof Error
            ? error.message
            : "Failed to refresh calendar access token.",
        events: [] as CalendarEvent[],
      };
    }
  }

  if (!accessToken) {
    return {
      connected: false,
      warning: "Calendar access token is missing. Reconnect Google Calendar.",
      events: [] as CalendarEvent[],
    };
  }

  try {
    const { events } = await fetchGoogleCalendarEvents({
      accessToken,
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults: 50,
    });

    return {
      connected: true,
      warning: undefined,
      events,
    };
  } catch (error) {
    return {
      connected: false,
      warning: error instanceof Error ? error.message : "Failed to fetch calendar events.",
      events: [] as CalendarEvent[],
    };
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as SmartScheduleRequest;
  const targetDate = getTargetDate(payload.date);
  const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [todos, calendar] = await Promise.all([
      readTodayTodos(user.id),
      readCalendarEvents({
        userId: user.id,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
      }),
    ]);

    const fallbackSchedule = getFallbackSchedule({
      events: calendar.events,
      todos,
      dayStart,
      dayEnd,
    });

    let source: SmartScheduleResponse["source"] = "fallback";
    let schedule = fallbackSchedule;

    try {
      const aiSchedule = await tryAiSchedule({
        date: dayStart.toISOString().slice(0, 10),
        events: calendar.events,
        todos,
        fallbackSchedule,
      });

      if (aiSchedule && aiSchedule.length > 0) {
        source = "ai";
        schedule = aiSchedule;
      }
    } catch {
      source = "fallback";
      schedule = fallbackSchedule;
    }

    const response: SmartScheduleResponse = {
      date: dayStart.toISOString().slice(0, 10),
      source,
      connectedCalendar: calendar.connected,
      schedule: schedule.map(({ startMinute, ...item }) => item),
      stats: {
        events: calendar.events.length,
        todos: todos.length,
      },
      warning: calendar.warning,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate smart schedule.",
      },
      { status: 500 }
    );
  }
}
