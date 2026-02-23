import {
  PrioritySuggestion,
  createFallbackPrioritySuggestion,
  normalizePriorityQuadrant,
  quadrantToPriority,
} from "@/lib/ai/priority";
import { isWorkflowStatus, type TaskModuleFlags } from "@/lib/types/task-payload";

export type SuggestPriorityRequest = {
  taskName: string;
  description?: string;
  dueDate?: number;
  projectId?: string;
  enabledModules?: Partial<TaskModuleFlags>;
  labelNames?: string[];
  personaNames?: string[];
  epicNames?: string[];
};

function isPrioritySuggestion(value: unknown): value is Partial<PrioritySuggestion> {
  return typeof value === "object" && value !== null;
}

function normalizeSuggestedText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSuggestedWorkload(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function normalizeSuggestedWorkflowStatus(
  value: unknown
): PrioritySuggestion["suggestedWorkflowStatus"] {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return isWorkflowStatus(normalized) ? normalized : undefined;
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
    suggestedLabelName: normalizeSuggestedText(payload.suggestedLabelName),
    suggestedPersonaName: normalizeSuggestedText(payload.suggestedPersonaName),
    suggestedEpicName: normalizeSuggestedText(payload.suggestedEpicName),
    suggestedStory: normalizeSuggestedText(payload.suggestedStory),
    suggestedWorkload: normalizeSuggestedWorkload(payload.suggestedWorkload),
    suggestedWorkflowStatus: normalizeSuggestedWorkflowStatus(
      payload.suggestedWorkflowStatus
    ),
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
