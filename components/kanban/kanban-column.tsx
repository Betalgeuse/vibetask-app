import { cn } from "@/lib/utils";
import { Doc } from "@/lib/supabase/types";
import Todos from "../todos/todos";
import { KanbanColumnKey } from "./metadata";

const COLUMN_BADGE_STYLES: Record<KanbanColumnKey, string> = {
  TODO: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  DONE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export default function KanbanColumn({
  column,
  title,
  subtitle,
  items,
}: {
  column: KanbanColumnKey;
  title: string;
  subtitle: string;
  items: Array<Doc<"todos">>;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
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

      <div className="pt-2">
        {items.length > 0 ? (
          <Todos items={items} />
        ) : (
          <p className="text-sm text-foreground/60 py-2">No tasks</p>
        )}
      </div>
    </section>
  );
}
