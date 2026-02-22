"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, CalendarDays, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type SmartScheduleBlock = {
  type: "calendar" | "focus";
  time: string;
  title?: string;
  tasks?: string[];
  note?: string;
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

type SmartScheduleProps = {
  className?: string;
};

export default function SmartSchedule({ className }: SmartScheduleProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartScheduleResponse | null>(null);

  const hasSchedule = (result?.schedule?.length ?? 0) > 0;

  const sourceLabel = useMemo(() => {
    if (!result) {
      return null;
    }

    return result.source === "ai" ? "AI-assisted" : "Rule-based fallback";
  }, [result]);

  const generateSchedule = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/smart-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => null)) as
        | (SmartScheduleResponse & { error?: string })
        | null;

      if (!response.ok || !payload) {
        setResult(null);
        setError(payload?.error?.trim() || "Failed to generate smart schedule.");
        return;
      }

      setResult(payload);
    } catch (nextError) {
      setResult(null);
      setError(nextError instanceof Error ? nextError.message : "Failed to generate smart schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Smart Schedule
          </h2>
          <p className="mt-1 text-xs text-foreground/70">
            Analyze today&apos;s tasks with calendar context and suggest focus blocks.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          className="gap-1"
          disabled={isLoading}
          onClick={() => {
            void generateSchedule();
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isLoading ? "Generating..." : "Plan my day (AI)"}
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border bg-background p-3 text-sm text-foreground/80">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
            <span className="rounded-full border px-2 py-0.5">{sourceLabel}</span>
            <span className="rounded-full border px-2 py-0.5">Tasks: {result.stats.todos}</span>
            <span className="rounded-full border px-2 py-0.5">Events: {result.stats.events}</span>
            <span className="rounded-full border px-2 py-0.5">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              {result.connectedCalendar ? "Calendar connected" : "Calendar not connected"}
            </span>
          </div>

          {result.warning && (
            <p className="rounded-md border bg-background p-2 text-xs text-foreground/80">
              {result.warning}
            </p>
          )}

          {hasSchedule ? (
            <ul className="space-y-2">
              {result.schedule.map((item, index) => (
                <li key={`${item.type}-${item.time}-${index}`} className="rounded-md border bg-background p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.time}</p>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide text-foreground/70">
                      {item.type}
                    </span>
                  </div>

                  {item.type === "calendar" ? (
                    <p className="text-sm text-foreground/90">{item.title ?? "Calendar event"}</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
                      {(item.tasks ?? []).map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                  )}

                  {item.note && <p className="mt-1 text-xs text-foreground/70">{item.note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border bg-background p-3 text-sm text-foreground/70">
              No suggested blocks yet. Add tasks or connect your calendar for richer suggestions.
            </p>
          )}

          {hasSchedule && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  toast({
                    title: "Schedule preview saved",
                    description:
                      "Apply wiring can be connected to task update/create-event flow in the next step.",
                  });
                }}
              >
                Apply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  toast({
                    title: "Edit coming soon",
                    description: "Manual block editing UI is planned in the next iteration.",
                  });
                }}
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
