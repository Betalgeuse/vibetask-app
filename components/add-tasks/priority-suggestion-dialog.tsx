"use client";

import {
  DEFAULT_PRIORITY_QUADRANT,
  PRIORITY_QUADRANT_OPTIONS,
  PriorityQuadrant,
  PrioritySuggestion,
} from "@/lib/ai/priority";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { type TaskModuleFlags } from "@/lib/types/task-payload";

type PrioritySuggestionDialogProps = {
  open: boolean;
  isSubmitting?: boolean;
  suggestion: PrioritySuggestion | null;
  enabledModules: TaskModuleFlags;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quadrant: PriorityQuadrant) => void;
};

export default function PrioritySuggestionDialog({
  open,
  isSubmitting = false,
  suggestion,
  enabledModules,
  onOpenChange,
  onConfirm,
}: PrioritySuggestionDialogProps) {
  const [selectedQuadrant, setSelectedQuadrant] =
    useState<PriorityQuadrant>(DEFAULT_PRIORITY_QUADRANT);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const dialogMessages = messages.dialogs.prioritySuggestion;
  const priorityQuadrantMessages = messages.tasks.priorityQuadrants;
  const moduleLabels = messages.settings.modules;
  const workflowStatusLabels = messages.tasks.workflowStatuses;
  const taskDetailMessages = messages.dialogs.taskDetails;

  const suggestedProperties: Array<{ key: string; label: string; value: string }> = [];

  if (suggestion?.suggestedLabelName) {
    suggestedProperties.push({
      key: "label",
      label: taskDetailMessages.metadataLabel,
      value: suggestion.suggestedLabelName,
    });
  }

  if (enabledModules.persona && suggestion?.suggestedPersonaName) {
    suggestedProperties.push({
      key: "persona",
      label: moduleLabels.persona.title,
      value: suggestion.suggestedPersonaName,
    });
  }

  if (enabledModules.epic && suggestion?.suggestedEpicName) {
    suggestedProperties.push({
      key: "epic",
      label: moduleLabels.epic.title,
      value: suggestion.suggestedEpicName,
    });
  }

  if (enabledModules.story && suggestion?.suggestedStory) {
    suggestedProperties.push({
      key: "story",
      label: moduleLabels.story.title,
      value: suggestion.suggestedStory,
    });
  }

  if (
    enabledModules.workload &&
    typeof suggestion?.suggestedWorkload === "number" &&
    Number.isFinite(suggestion.suggestedWorkload)
  ) {
    suggestedProperties.push({
      key: "workload",
      label: moduleLabels.workload.title,
      value: `${suggestion.suggestedWorkload}`,
    });
  }

  if (enabledModules.workflowStatus && suggestion?.suggestedWorkflowStatus) {
    suggestedProperties.push({
      key: "workflowStatus",
      label: moduleLabels.workflowStatus.title,
      value:
        workflowStatusLabels[suggestion.suggestedWorkflowStatus] ??
        suggestion.suggestedWorkflowStatus,
    });
  }

  useEffect(() => {
    if (suggestion?.quadrant) {
      setSelectedQuadrant(suggestion.quadrant);
    }
  }, [suggestion]);

  if (!suggestion) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogMessages.title}</DialogTitle>
          <DialogDescription>
            {dialogMessages.suggestedQuadrantPrefix}{" "}
            <strong>{priorityQuadrantMessages[suggestion.quadrant].title}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-foreground/80">{suggestion.reason}</p>
          {suggestion.usedFallback && (
            <p className="text-xs text-foreground/60">
              {dialogMessages.fallbackDescription}
            </p>
          )}

          {suggestedProperties.length > 0 && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                {dialogMessages.suggestedPropertiesTitle}
              </p>
              <ul className="space-y-1.5">
                {suggestedProperties.map((item) => (
                  <li
                    key={item.key}
                    className="grid grid-cols-[110px_1fr] gap-2 text-xs"
                  >
                    <span className="font-medium text-foreground/70">{item.label}</span>
                    <span className="break-words text-foreground/90">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">{dialogMessages.pickQuadrant}</p>
            <Select
              value={selectedQuadrant}
              onValueChange={(value) => setSelectedQuadrant(value as PriorityQuadrant)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_QUADRANT_OPTIONS.map(({ quadrant }) => (
                  <SelectItem key={quadrant} value={quadrant}>
                    {priorityQuadrantMessages[quadrant].title} —{" "}
                    {priorityQuadrantMessages[quadrant].subtitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {dialogMessages.cancel}
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(selectedQuadrant)}
          >
            {isSubmitting ? dialogMessages.confirming : dialogMessages.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
