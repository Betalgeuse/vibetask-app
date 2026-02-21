import { createClient } from "@/lib/supabase/server";
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

async function resolveAiLabelId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: labels, error: labelsError } = await supabase
    .from("labels")
    .select("id,name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (labelsError) {
    throw labelsError;
  }

  const aiLabel = labels?.find((label) => label.name.toLowerCase().includes("ai"));
  if (aiLabel?.id) {
    return aiLabel.id;
  }

  if (labels?.[0]?.id) {
    return labels[0].id;
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
  return inserted.id;
}

function parseTodosFromContent(content: string | null) {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.todos) ? parsed.todos : [];
  } catch {
    return [];
  }
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
  const { projectId } = body as { projectId?: string };

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
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
      .from("todos")
      .select("task_name,description")
      .eq("user_id", user.id)
      .eq("project_id", projectId);
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

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Suggest 5 missing tasks. Return JSON object with key 'todos', each item having taskName and description.",
        },
        {
          role: "user",
          content: JSON.stringify({
            todos,
            projectName: project.name,
          }),
        },
      ],
    });

    const items = parseTodosFromContent(completion.choices?.[0]?.message?.content ?? null);
    const aiLabelId = await resolveAiLabelId(supabase, user.id);

    if (items.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const inserts: Array<{
      user_id: string;
      task_name: string;
      description: string | null;
      priority: number;
      due_date: number;
      project_id: string;
      label_id: string;
      is_completed: boolean;
    }> = items
      .map((item: { taskName?: string; description?: string }) => ({
        user_id: user.id,
        task_name: item.taskName?.trim() ?? "",
        description: item.description?.trim() ?? null,
        priority: 1,
        due_date: Date.now(),
        project_id: projectId,
        label_id: aiLabelId,
        is_completed: false,
      }))
      .filter((item: { task_name: string }) => item.task_name.length > 0);

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("todos").insert(inserts);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ created: inserts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
