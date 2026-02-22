import { createClient } from "@/lib/supabase/server";
import { normalizeTaskModuleFlags } from "@/lib/types/task-payload";
import OpenAI from "openai";
import { NextResponse } from "next/server";

const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY;
const usingGemini = Boolean(geminiApiKey);
const resolvedApiKey = geminiApiKey ?? openAiApiKey ?? null;

const openai = new OpenAI({
  apiKey: resolvedApiKey ?? undefined,
  ...(usingGemini
    ? { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai" }
    : {}),
});

const CHAT_MODEL = usingGemini ? "gemini-2.0-flash" : "gpt-3.5-turbo";

type NamedOption = {
  id: string;
  name: string;
};

type NamedOptionWithDescription = NamedOption & {
  description: string | null;
};

type SuggestedReference =
  | {
      type: "existing";
      id: string;
      name: string;
    }
  | {
      type: "new";
      name: string;
    };

type SuggestedTodo = {
  taskName: string;
  description: string | null;
  suggestedLabel: SuggestedReference;
  suggestedPersona?: SuggestedReference;
  suggestedEpic?: SuggestedReference;
  suggestedStory?: string;
  suggestedWorkload?: number;
};

type EnabledSuggestionModules = {
  persona: boolean;
  epic: boolean;
  story: boolean;
  workload: boolean;
};

async function fetchEnabledModules(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<EnabledSuggestionModules> {
  const { data: settings, error } = await supabase
    .from("user_feature_settings")
    .select("enabled_modules")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  const normalized = normalizeTaskModuleFlags(settings?.enabled_modules);
  return {
    persona: normalized.persona,
    epic: normalized.epic,
    story: normalized.story,
    workload: normalized.workload,
  };
}

async function fetchLabelsWithFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ labels: NamedOption[]; fallbackLabel: NamedOption }> {
  const { data: labels, error: labelsError } = await supabase
    .from("labels")
    .select("id,name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (labelsError) {
    throw labelsError;
  }

  const normalizedLabels = ((labels ?? []) as NamedOption[])
    .map((label) => ({
      id: label.id,
      name: label.name,
    }))
    .filter((label) => Boolean(label.id && label.name));

  const aiLabel =
    normalizedLabels.find((label) => label.name.toLowerCase().includes("ai")) ??
    null;

  if (aiLabel) {
    return {
      labels: normalizedLabels,
      fallbackLabel: aiLabel,
    };
  }

  if (normalizedLabels.length > 0) {
    return {
      labels: normalizedLabels,
      fallbackLabel: normalizedLabels[0],
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("labels")
    .insert({
      user_id: userId,
      name: "AI",
      type: "user",
    })
    .select("id")
    .single();
  if (insertError) {
    throw insertError;
  }

  const insertedLabel = {
    id: inserted.id as string,
    name: "AI",
  };

  return {
    labels: [...normalizedLabels, insertedLabel],
    fallbackLabel: insertedLabel,
  };
}

async function fetchPersonas(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<NamedOptionWithDescription[]> {
  const { data, error } = await supabase
    .from("personas")
    .select("id,name,description")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }

  return ((data ?? []) as NamedOptionWithDescription[])
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
    .filter((item) => Boolean(item.id && item.name));
}

async function fetchEpics(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<NamedOptionWithDescription[]> {
  const { data, error } = await supabase
    .from("epics")
    .select("id,name,description")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }

  return ((data ?? []) as NamedOptionWithDescription[])
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
    .filter((item) => Boolean(item.id && item.name));
}

function parseTodosFromContent(content: string | null): Record<string, unknown>[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.todos)) {
      return [];
    }
    return parsed.todos.filter(
      (item: unknown): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    );
  } catch {
    return [];
  }
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function findOptionByName<T extends NamedOption>(
  options: T[],
  value: string
): T | null {
  const target = value.trim().toLowerCase();
  if (!target) {
    return null;
  }
  return (
    options.find((option) => option.name.trim().toLowerCase() === target) ?? null
  );
}

function toExistingReference(option: NamedOption): SuggestedReference {
  return {
    type: "existing",
    id: option.id,
    name: option.name,
  };
}

function parseReferenceValue(
  value: unknown,
  options: NamedOption[]
): SuggestedReference | undefined {
  if (typeof value === "string") {
    const name = readText(value);
    if (!name) {
      return undefined;
    }
    const byName = findOptionByName(options, name);
    if (byName) {
      return toExistingReference(byName);
    }
    return { type: "new", name };
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const rawId = readText(raw.id);
  if (rawId) {
    const byId = options.find((option) => option.id === rawId);
    if (byId) {
      return toExistingReference(byId);
    }
  }

  const rawName = readText(raw.name);
  if (rawName) {
    const byName = findOptionByName(options, rawName);
    if (byName) {
      return toExistingReference(byName);
    }
    return { type: "new", name: rawName };
  }

  return undefined;
}

function parseReferenceFromItem(
  item: Record<string, unknown>,
  objectKeys: string[],
  nameKeys: string[],
  options: NamedOption[]
): SuggestedReference | undefined {
  for (const key of objectKeys) {
    const parsed = parseReferenceValue(item[key], options);
    if (parsed) {
      return parsed;
    }
  }

  for (const key of nameKeys) {
    const parsed = parseReferenceValue(item[key], options);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function parseWorkloadValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(100, Math.round(value)));
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(100, Math.round(parsed)));
    }
  }

  return undefined;
}

function buildSystemPrompt(enabledModules: EnabledSuggestionModules) {
  const schemaLines = [
    '- taskName: string',
    '- description: string',
    '- suggestedLabel: {"type":"existing","id":"...","name":"..."} or {"type":"new","name":"..."}',
  ];

  if (enabledModules.persona) {
    schemaLines.push(
      '- suggestedPersona: {"type":"existing","id":"...","name":"..."} or {"type":"new","name":"...","description":"..."}'
    );
  }

  if (enabledModules.epic) {
    schemaLines.push(
      '- suggestedEpic: {"type":"existing","id":"...","name":"..."} or {"type":"new","name":"...","description":"..."}'
    );
  }

  if (enabledModules.story) {
    schemaLines.push("- suggestedStory: string");
  }

  if (enabledModules.workload) {
    schemaLines.push("- suggestedWorkload: integer 1-100");
  }

  return [
    "Suggest 2 missing sub tasks.",
    "Return ONLY a JSON object with key 'todos'.",
    "Each item in 'todos' must include these fields:",
    ...schemaLines,
    "If a module is disabled, omit that field.",
    "Do not include markdown.",
  ].join("\n");
}

export async function POST(request: Request) {
  if (!resolvedApiKey) {
    return NextResponse.json(
      {
        error:
          "No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.",
      },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { projectId, parentId, taskName, description, autoCreate = true } = body as {
    projectId?: string;
    parentId?: string;
    taskName?: string;
    description?: string;
    autoCreate?: boolean;
  };

  if (!projectId || !parentId) {
    return NextResponse.json(
      { error: "projectId and parentId are required" },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: todos, error: todosError } = await supabase
      .from("sub_todos")
      .select("task_name,description")
      .eq("user_id", user.id)
      .eq("parent_id", parentId);
    if (todosError) throw todosError;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id,name,type,user_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.type !== "system" && project.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enabledModules = await fetchEnabledModules(supabase, user.id);
    const { labels, fallbackLabel } = await fetchLabelsWithFallback(
      supabase,
      user.id
    );
    const personas = enabledModules.persona
      ? await fetchPersonas(supabase, user.id)
      : [];
    const epics = enabledModules.epic ? await fetchEpics(supabase, user.id) : [];

    const promptContext: Record<string, unknown> = {
      todos,
      projectName: project.name,
      parentTodo: {
        taskName: taskName ?? "",
        description: description ?? "",
      },
      availableLabels: labels,
      enabledModules,
    };

    if (enabledModules.persona) {
      promptContext.availablePersonas = personas;
    }

    if (enabledModules.epic) {
      promptContext.availableEpics = epics;
    }

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(enabledModules),
        },
        {
          role: "user",
          content: JSON.stringify(promptContext),
        },
      ],
    });

    const rawItems = parseTodosFromContent(
      completion.choices?.[0]?.message?.content ?? null
    );
    const recommendations: SuggestedTodo[] = rawItems
      .map((item: Record<string, unknown>) => {
        const suggestedTaskName = readText(item.taskName);
        if (!suggestedTaskName) {
          return null;
        }

        const suggestedDescription = readText(item.description);
        const suggestedLabel =
          parseReferenceFromItem(
            item,
            ["suggestedLabel", "label"],
            ["suggestedLabelName", "labelName"],
            labels
          ) ?? toExistingReference(fallbackLabel);

        const recommendation: SuggestedTodo = {
          taskName: suggestedTaskName,
          description: suggestedDescription,
          suggestedLabel,
        };

        if (enabledModules.persona) {
          const suggestedPersona = parseReferenceFromItem(
            item,
            ["suggestedPersona", "persona"],
            ["suggestedPersonaName", "personaName"],
            personas
          );
          if (suggestedPersona) {
            recommendation.suggestedPersona = suggestedPersona;
          }
        }

        if (enabledModules.epic) {
          const suggestedEpic = parseReferenceFromItem(
            item,
            ["suggestedEpic", "epic"],
            ["suggestedEpicName", "epicName"],
            epics
          );
          if (suggestedEpic) {
            recommendation.suggestedEpic = suggestedEpic;
          }
        }

        if (enabledModules.story) {
          const suggestedStory =
            readText(item.suggestedStory) ?? readText(item.story);
          if (suggestedStory) {
            recommendation.suggestedStory = suggestedStory;
          }
        }

        if (enabledModules.workload) {
          const suggestedWorkload =
            parseWorkloadValue(item.suggestedWorkload) ??
            parseWorkloadValue(item.workload);
          if (typeof suggestedWorkload === "number") {
            recommendation.suggestedWorkload = suggestedWorkload;
          }
        }

        return recommendation;
      })
      .filter((item: SuggestedTodo | null): item is SuggestedTodo => item !== null);

    const shouldAutoCreate = autoCreate !== false;

    if (recommendations.length === 0) {
      return NextResponse.json({
        created: 0,
        autoCreated: false,
        enabledModules,
        recommendations: [],
      });
    }

    if (!shouldAutoCreate) {
      return NextResponse.json({
        created: 0,
        autoCreated: false,
        enabledModules,
        recommendations,
      });
    }

    const inserts: Array<{
      user_id: string;
      task_name: string;
      description: string | null;
      story: string | null;
      workload: number | null;
      epic_id: string | null;
      persona_id: string | null;
      priority: number;
      due_date: number;
      project_id: string;
      parent_id: string;
      label_id: string;
      is_completed: boolean;
    }> = recommendations.map((item) => ({
      user_id: user.id,
      task_name: item.taskName,
      description: item.description,
      story: enabledModules.story ? item.suggestedStory ?? null : null,
      workload:
        enabledModules.workload && typeof item.suggestedWorkload === "number"
          ? item.suggestedWorkload
          : null,
      epic_id:
        enabledModules.epic && item.suggestedEpic?.type === "existing"
          ? item.suggestedEpic.id
          : null,
      persona_id:
        enabledModules.persona && item.suggestedPersona?.type === "existing"
          ? item.suggestedPersona.id
          : null,
      priority: 1,
      due_date: Date.now(),
      project_id: projectId,
      parent_id: parentId,
      label_id:
        item.suggestedLabel.type === "existing"
          ? item.suggestedLabel.id
          : fallbackLabel.id,
      is_completed: false,
    }));

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from("sub_todos")
        .insert(inserts);
      if (insertError) throw insertError;
    }

    return NextResponse.json({
      created: inserts.length,
      autoCreated: true,
      enabledModules,
      recommendations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
