import { cn } from "@/lib/utils";
import { Doc } from "@/lib/supabase/types";
import Todos from "../todos/todos";
import QuickTaskInput from "../shared/quick-task-input";
import { KanbanColumnKey } from "./metadata";
import type { TodoStatus } from "@/lib/types/priority";
import type { WorkflowStatus } from "@/lib/types/task-payload";
import { useDroppable } from "@dnd-kit/core";

const COLUMN_BADGE_STYLES: Record<KanbanColumnKey, string> = {
  TODO: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  DONE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const COLUMN_QUICK_TASK_DEFAULTS: Record<
  KanbanColumnKey,
  { status: TodoStatus; workflowStatus: WorkflowStatus }
> = {
  TODO: {
    status: "TODO",
    workflowStatus: "BACKLOG",
  },
  IN_PROGRESS: {
    status: "IN_PROGRESS",
    workflowStatus: "THIS_WEEK",
  },
  DONE: {
    status: "DONE",
    workflowStatus: "DONE",
  },
};

export default function KanbanColumn({
  column,
  title,
  subtitle,
  emptyStateText = "No tasks",
  items,
}: {
  column: KanbanColumnKey;
  title: string;
  subtitle: string;
  emptyStateText?: string;
  items: Array<Doc<"todos">>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-card p-4 text-card-foreground shadow-sm min-h-[200px] transition-colors",
        isOver && "bg-primary/5 border-primary"
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-foreground/70">{subtitle}</p>
        </div>
        <span
          className={cn(
            "text-xs rounded-full px-2 py-1",
            COLUMN_BADGE_STYLES[column]
          )}
        >
          {items.length}
        </span>
      </div>

      <div className="pt-2 space-y-2">
        {items.length > 0 ? (
          <Todos items={items} />
        ) : (
          <p className="text-sm text-foreground/60 py-2">{emptyStateText}</p>
        )}
        <QuickTaskInput defaultValues={COLUMN_QUICK_TASK_DEFAULTS[column]} />
      </div>
    </section>
  );
}
