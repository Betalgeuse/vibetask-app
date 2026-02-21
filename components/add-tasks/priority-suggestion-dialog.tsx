"use client";

import {
  DEFAULT_PRIORITY_QUADRANT,
  PRIORITY_QUADRANT_OPTIONS,
  PriorityQuadrant,
  PrioritySuggestion,
  getQuadrantLabel,
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
import { useEffect, useState } from "react";

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
          <DialogTitle>Confirm suggested priority</DialogTitle>
          <DialogDescription>
            Suggested quadrant: <strong>{getQuadrantLabel(suggestion.quadrant)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-foreground/80">{suggestion.reason}</p>
          {suggestion.usedFallback && (
            <p className="text-xs text-foreground/60">
              AI is unavailable right now. A default quadrant was suggested.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Pick a quadrant</p>
            <Select
              value={selectedQuadrant}
              onValueChange={(value) => setSelectedQuadrant(value as PriorityQuadrant)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_QUADRANT_OPTIONS.map(({ quadrant, label, subtitle }) => (
                  <SelectItem key={quadrant} value={quadrant}>
                    {label} — {subtitle}
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
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(selectedQuadrant)}
          >
            {isSubmitting ? "Adding task..." : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
