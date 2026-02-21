import {
  createFallbackPrioritySuggestion,
  normalizePriorityQuadrant,
  quadrantToPriority,
} from "@/lib/ai/priority";
import { normalizePrioritySuggestion } from "@/lib/ai/suggest-priority";
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

function toDueDateSummary(dueDate?: number) {
  if (!dueDate) {
    return "No due date provided.";
  }

  const asDate = new Date(dueDate);
  if (Number.isNaN(asDate.getTime())) {
    return "Due date is invalid.";
  }

  return `Due date: ${asDate.toISOString()}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    taskName?: string;
    description?: string;
    dueDate?: number;
    projectId?: string;
  };

  const taskName = body.taskName?.trim();
  const description = body.description?.trim();
  const dueDate = Number(body.dueDate);

  if (!taskName) {
    return NextResponse.json({ error: "taskName is required" }, { status: 400 });
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

  if (!resolvedApiKey || !openai) {
    return NextResponse.json(
      createFallbackPrioritySuggestion(
        "AI key is not configured. Using default priority suggestion."
      )
    );
  }

  try {
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Classify tasks into one Eisenhower quadrant. Return JSON object with keys: quadrant and reason. quadrant must be one of: doFirst, schedule, delegate, eliminate. Keep reason short.",
        },
        {
          role: "user",
          content: JSON.stringify({
            taskName,
            description: description ?? "",
            projectId: body.projectId ?? "",
            dueDateSummary: Number.isFinite(dueDate)
              ? toDueDateSummary(dueDate)
              : "No due date provided.",
          }),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? null;

    if (!content) {
      return NextResponse.json(
        createFallbackPrioritySuggestion(
          "AI returned an empty response. Using default priority suggestion."
        )
      );
    }

    const parsed = JSON.parse(content) as {
      quadrant?: string;
      reason?: string;
    };

    const normalizedQuadrant = normalizePriorityQuadrant(parsed.quadrant ?? null);

    if (!normalizedQuadrant) {
      return NextResponse.json(
        createFallbackPrioritySuggestion(
          "AI returned an unsupported quadrant. Using default priority suggestion."
        )
      );
    }

    const reason = parsed.reason?.trim() || "Priority suggested from task details.";

    return NextResponse.json(
      normalizePrioritySuggestion({
        quadrant: normalizedQuadrant,
        priority: quadrantToPriority(normalizedQuadrant),
        reason,
        source: "ai",
      })
    );
  } catch (_error) {
    return NextResponse.json(
      createFallbackPrioritySuggestion(
        "AI request failed. Using default priority suggestion."
      )
    );
  }
}
