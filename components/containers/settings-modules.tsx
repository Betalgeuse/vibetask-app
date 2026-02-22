"use client";

import { useMemo } from "react";

import {
  authorizeCalendarAction,
  disconnectCalendarAction,
} from "@/actions/calendar-action";
import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_TASK_MODULE_FLAGS,
  TASK_MODULE_KEYS,
  type TaskModuleKey,
} from "@/lib/types/task-payload";

const MODULE_LABELS: Record<TaskModuleKey, { title: string; description: string }> = {
  persona: {
    title: "Persona",
    description:
      "Enable custom persona property and persona navigation for your own taxonomy.",
  },
  epic: {
    title: "Epic",
    description: "Enable epic grouping field for tasks.",
  },
  story: {
    title: "Story",
    description: "Show context/background story field while creating tasks.",
  },
  workload: {
    title: "Workload",
    description: "Track expected effort/energy score on tasks.",
  },
  workflowStatus: {
    title: "Workflow Status",
    description: "Use Backlog/Week/Today style status on task payload.",
  },
  calendarSync: {
    title: "Calendar Sync",
    description: "Prepare for Google Calendar sync behavior (future integration).",
  },
};

export default function SettingsModules() {
  const settings = useQuery(api.userFeatureSettings.getMySettings);
  const upsertSettings = useMutation(api.userFeatureSettings.upsertMySettings);

  const enabledModules = useMemo(
    () => settings?.enabledModules ?? DEFAULT_TASK_MODULE_FLAGS,
    [settings?.enabledModules]
  );

  const onToggle = async (key: TaskModuleKey, enabled: boolean) => {
    const nextModules = {
      ...enabledModules,
      [key]: enabled,
    };
    const sidebarModules = nextModules.persona ? ["personas"] : [];

    await upsertSettings({
      enabledModules: nextModules,
      sidebarModules,
      taskPropertyVisibility: {
        persona: nextModules.persona,
        epic: nextModules.epic,
        story: nextModules.story,
        workload: nextModules.workload,
        workflowStatus: nextModules.workflowStatus,
      },
    });
  };

  return (
    <div className="xl:px-40">
      <h1 className="text-lg font-semibold md:text-2xl">Feature Settings</h1>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Turn task properties on only when you want them. Hidden properties stay in
        payload structure for future UX changes.
      </p>

      <div className="rounded-lg border bg-card">
        {TASK_MODULE_KEYS.map((key) => {
          const label = MODULE_LABELS[key];
          const checked = enabledModules[key];
          return (
            <div
              key={key}
              className="flex items-start justify-between gap-4 border-b last:border-b-0 p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">{label.title}</p>
                <p className="text-xs text-foreground/70 mt-1">{label.description}</p>
                {key === "calendarSync" && checked && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={authorizeCalendarAction}>
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        Connect Google Calendar
                      </button>
                    </form>
                    <form action={disconnectCalendarAction}>
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        Disconnect
                      </button>
                    </form>
                  </div>
                )}
              </div>
              <label className="mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={(event) => onToggle(key, event.target.checked)}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
