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

type PrioritySuggestionDialogProps = {
  open: boolean;
  isSubmitting?: boolean;
  suggestion: PrioritySuggestion | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quadrant: PriorityQuadrant) => void;
};

export default function PrioritySuggestionDialog({
  open,
  isSubmitting = false,
  suggestion,
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
