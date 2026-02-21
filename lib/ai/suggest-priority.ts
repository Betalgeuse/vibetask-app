import {
  PrioritySuggestion,
  createFallbackPrioritySuggestion,
  normalizePriorityQuadrant,
  quadrantToPriority,
} from "@/lib/ai/priority";

export type SuggestPriorityRequest = {
  taskName: string;
  description?: string;
  dueDate?: number;
  projectId?: string;
};

function isPrioritySuggestion(value: unknown): value is Partial<PrioritySuggestion> {
  return typeof value === "object" && value !== null;
}

export function normalizePrioritySuggestion(
  payload: unknown,
  fallbackReason?: string
): PrioritySuggestion {
  if (!isPrioritySuggestion(payload)) {
    return createFallbackPrioritySuggestion(
      fallbackReason ?? "AI response was invalid. Using default priority."
    );
  }

  const normalizedQuadrant = normalizePriorityQuadrant(
    typeof payload.quadrant === "string" ? payload.quadrant : null
  );

  if (!normalizedQuadrant) {
    return createFallbackPrioritySuggestion(
      fallbackReason ?? "AI returned an unknown quadrant. Using default priority."
    );
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  return {
    quadrant: normalizedQuadrant,
    priority: quadrantToPriority(normalizedQuadrant),
    reason: reason || "Priority suggested from task context.",
    source: payload.source === "ai" ? "ai" : "fallback",
    usedFallback: payload.source === "ai" ? false : true,
  };
}

export async function suggestPriorityForTask(
  request: SuggestPriorityRequest
): Promise<PrioritySuggestion> {
  const response = await fetch("/api/ai/suggest-priority", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Failed to suggest priority");
  }

  const payload = (await response.json()) as unknown;

  return normalizePrioritySuggestion(payload);
}
