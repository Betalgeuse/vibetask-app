import type { WorkflowStatus } from "@/lib/types/task-payload";

export type PriorityQuadrant = "doFirst" | "schedule" | "delegate" | "eliminate";

export type PrioritySuggestionSource = "ai" | "fallback";

export type PrioritySuggestion = {
  quadrant: PriorityQuadrant;
  priority: 1 | 2 | 3 | 4;
  reason: string;
  source: PrioritySuggestionSource;
  usedFallback: boolean;
  suggestedLabelName?: string;
  suggestedPersonaName?: string;
  suggestedEpicName?: string;
  suggestedStory?: string;
  suggestedWorkload?: number;
  suggestedWorkflowStatus?: WorkflowStatus;
};

export const PRIORITY_QUADRANT_OPTIONS: Array<{
  quadrant: PriorityQuadrant;
  label: string;
  subtitle: string;
  priority: 1 | 2 | 3 | 4;
}> = [
  {
    quadrant: "doFirst",
    label: "Do First",
    subtitle: "Urgent + Important",
    priority: 1,
  },
  {
    quadrant: "schedule",
    label: "Schedule",
    subtitle: "Not Urgent + Important",
    priority: 2,
  },
  {
    quadrant: "delegate",
    label: "Delegate",
    subtitle: "Urgent + Not Important",
    priority: 3,
  },
  {
    quadrant: "eliminate",
    label: "Eliminate",
    subtitle: "Not Urgent + Not Important",
    priority: 4,
  },
];

export const DEFAULT_PRIORITY_QUADRANT: PriorityQuadrant = "doFirst";

export function isPriorityQuadrant(value: string): value is PriorityQuadrant {
  return PRIORITY_QUADRANT_OPTIONS.some(({ quadrant }) => quadrant === value);
}

export function normalizePriorityQuadrant(
  value: string | null | undefined
): PriorityQuadrant | null {
  if (!value) return null;

  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");

  switch (normalized) {
    case "dofirst":
    case "urgentimportant":
      return "doFirst";
    case "schedule":
    case "importantnoturgent":
      return "schedule";
    case "delegate":
    case "urgentnotimportant":
      return "delegate";
    case "eliminate":
    case "noturgentnotimportant":
      return "eliminate";
    default:
      return null;
  }
}

export function quadrantToPriority(quadrant: PriorityQuadrant): 1 | 2 | 3 | 4 {
  const item = PRIORITY_QUADRANT_OPTIONS.find((option) => option.quadrant === quadrant);
  return item?.priority ?? 1;
}

export function priorityToQuadrant(
  priority: number | string | null | undefined
): PriorityQuadrant {
  const parsed = Number(priority);
  if (parsed === 1) return "doFirst";
  if (parsed === 2) return "schedule";
  if (parsed === 3) return "delegate";
  if (parsed === 4) return "eliminate";
  return DEFAULT_PRIORITY_QUADRANT;
}

export function getQuadrantLabel(quadrant: PriorityQuadrant) {
  return (
    PRIORITY_QUADRANT_OPTIONS.find((item) => item.quadrant === quadrant)?.label ??
    "Do First"
  );
}

export function createFallbackPrioritySuggestion(
  reason = "AI suggestion is unavailable. Using default priority."
): PrioritySuggestion {
  return {
    quadrant: DEFAULT_PRIORITY_QUADRANT,
    priority: quadrantToPriority(DEFAULT_PRIORITY_QUADRANT),
    reason,
    source: "fallback",
    usedFallback: true,
  };
}
