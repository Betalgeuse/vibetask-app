"use client";

import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";
import CompletedTodos from "@/components/todos/completed-todos";
import Todos from "@/components/todos/todos";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import { Id } from "@/lib/supabase/types";
import { useMemo } from "react";
import { useParams } from "next/navigation";

export default function LabelTasksPage() {
  const { labelId } = useParams<{ labelId: Id<"labels"> }>();
  const label = useQuery(api.labels.getLabelByLabelId, { labelId });
  const todosQuery = useQuery(api.todos.get);
  const todos = useMemo(() => todosQuery ?? [], [todosQuery]);

  const { inCompleted, completed } = useMemo(() => {
    const filtered = todos.filter((todo) => todo.labelId === labelId);
    return {
      inCompleted: filtered.filter((todo) => !todo.isCompleted),
      completed: filtered.filter((todo) => todo.isCompleted),
    };
  }, [labelId, todos]);

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Filters & Labels" navLink="/loggedin/filter-labels" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <div className="xl:px-40">
            <h1 className="text-lg font-semibold md:text-2xl">
              #{label?.name ?? "Label"}
            </h1>
            <p className="text-sm text-foreground/70 mt-2 mb-4">
              Tasks filtered by this label.
            </p>

            <Todos items={inCompleted} />
            <Todos items={completed} />
            <div className="flex items-center space-x-4 gap-2 border-b-2 p-2 border-gray-100 text-sm text-foreground/80">
              <CompletedTodos totalTodos={completed.length} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
