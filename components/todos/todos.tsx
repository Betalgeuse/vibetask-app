import React from "react";
import Task from "./task";
import { useMemo } from "react";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Doc } from "@/lib/supabase/types";
import { useToast } from "../ui/use-toast";

export default function Todos({ items }: { items: Array<Doc<"todos">> }) {
  const { toast } = useToast();
  const labelsQuery = useQuery(api.labels.getLabels);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const isCalendarSyncEnabled = Boolean(featureSettings?.enabledModules?.calendarSync);
  const labelsById = useMemo(
    () => new Map((labelsQuery ?? []).map((label) => [label._id, label])),
    [labelsQuery]
  );

  const checkATodo = useMutation(api.todos.checkATodo);
  const unCheckATodo = useMutation(api.todos.unCheckATodo);

  const handleOnChangeTodo = (task: Doc<"todos">) => {
    if (task.isCompleted) {
      unCheckATodo({ taskId: task._id });
    } else {
      checkATodo({ taskId: task._id });
      toast({
        title: "✅ Task completed",
        description: "You're a rockstar",
        duration: 3000,
      });
    }
  };
  return items.map((task: Doc<"todos">) => (
    <Task
      key={task._id}
      data={task}
      label={labelsById.get(task.labelId) ?? null}
      isCompleted={task.isCompleted}
      handleOnChange={() => handleOnChangeTodo(task)}
      canExportToCalendar={isCalendarSyncEnabled}
    />
  ));
}
