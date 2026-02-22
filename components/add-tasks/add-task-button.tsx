import { Plus } from "lucide-react";
import React, { Dispatch, SetStateAction, useMemo, useState } from "react";
import AddTaskInline from "./add-task-inline";
import { Doc, Id } from "@/lib/supabase/types";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";

export const AddTaskWrapper = ({
  parentTask,
  projectId,
}: {
  parentTask?: Doc<"todos">;
  projectId?: Id<"projects">;
}) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);

  return showAddTask ? (
    <AddTaskInline
      setShowAddTask={setShowAddTask}
      parentTask={parentTask}
      projectId={projectId}
    />
  ) : (
    <AddTaskButton
      onClick={() => setShowAddTask(true)}
      title={parentTask?._id ? messages.tasks.addSubTask : messages.tasks.addTask}
    />
  );
};

export default function AddTaskButton({
  onClick,
  title,
}: {
  onClick: Dispatch<SetStateAction<any>>;
  title: string;
}) {
  return (
    <button className="pl-2 flex mt-2 flex-1" onClick={onClick}>
      <div className="flex flex-col items-center justify-center gap-1 text-center">
        <div className="flex items-center gap-2 justify-center">
          <Plus className="h-4 w-4 text-primary hover:bg-primary hover:rounded-xl hover:text-white" />
          <h3 className="text-base font-light tracking-tight text-foreground/70">
            {title}
          </h3>
        </div>
      </div>
    </button>
  );
}
