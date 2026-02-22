"use client";

import Link from "next/link";
import { useMemo } from "react";

import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import { Doc } from "@/lib/supabase/types";
import AddLabelDialog from "../labels/add-label-dialog";
import { BadgePlus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";

export default function FilterLabels() {
  const labels = useQuery(api.labels.getLabels) ?? [];
  const todosQuery = useQuery(api.todos.get);
  const todos = useMemo(() => todosQuery ?? [], [todosQuery]);

  const totalsByLabelId = useMemo(() => {
    return todos.reduce<Record<string, number>>((acc, todo) => {
      acc[todo.labelId] = (acc[todo.labelId] ?? 0) + 1;
      return acc;
    }, {});
  }, [todos]);

  return (
    <div className="xl:px-40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold md:text-2xl">Filters & Labels</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button">Add Label</Button>
          </DialogTrigger>
          <AddLabelDialog />
        </Dialog>
      </div>

      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Create labels and open a label to view only matching tasks.
      </p>

      {labels.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <p className="text-sm text-foreground/70">
            No labels yet. Create your first label.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {labels.map((label: Doc<"labels">) => {
            const count = totalsByLabelId[label._id] ?? 0;
            return (
              <Link
                key={label._id}
                href={`/loggedin/filter-labels/${label._id}`}
                className={cn(
                  "rounded-lg border bg-card p-4 text-card-foreground transition-colors",
                  "hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full border"
                      style={{
                        backgroundColor: label.color,
                        borderColor: label.color,
                      }}
                    />
                    <Tag
                      className="h-4 w-4"
                      style={{
                        color: label.color,
                      }}
                    />
                    <p className="font-medium">{label.name}</p>
                  </div>
                  <p className="text-xs text-foreground/70">{count} tasks</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-foreground/60">
                  <BadgePlus className="h-3 w-3" />
                  Open label view
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
