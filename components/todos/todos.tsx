import React from "react";
import DraggableTask from "./draggable-task";
import { useMemo } from "react";
import { useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Doc } from "@/lib/supabase/types";

export default function Todos({ items }: { items: Array<Doc<"todos">> }) {
  const labelsQuery = useQuery(api.labels.getLabels);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const isCalendarSyncEnabled = Boolean(featureSettings?.enabledModules?.calendarSync);
  const labelsById = useMemo(
    () => new Map((labelsQuery ?? []).map((label) => [label._id, label])),
    [labelsQuery]
  );

  return items.map((task: Doc<"todos">) => (
    <DraggableTask
      key={task._id}
      data={task}
      label={labelsById.get(task.labelId) ?? null}
      isCompleted={task.isCompleted}
      handleOnChange={() => {}}
      canExportToCalendar={isCalendarSyncEnabled}
    />
  ));
}
