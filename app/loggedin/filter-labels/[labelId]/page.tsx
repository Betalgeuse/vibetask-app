"use client";

import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";
import CompletedTodos from "@/components/todos/completed-todos";
import Todos from "@/components/todos/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { Id } from "@/lib/supabase/types";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function LabelTasksPage() {
  const { labelId } = useParams<{ labelId: Id<"labels"> }>();
  const label = useQuery(api.labels.getLabelByLabelId, { labelId });
  const updateLabelMutation = useMutation(api.labels.updateALabel);
  const { toast } = useToast();
  const todosQuery = useQuery(api.todos.get);
  const todos = useMemo(() => todosQuery ?? [], [todosQuery]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!label) {
      return;
    }

    setName(label.name);
    setColor(label.color);
  }, [label]);

  const { inCompleted, completed } = useMemo(() => {
    const filtered = todos.filter((todo) => todo.labelId === labelId);
    return {
      inCompleted: filtered.filter((todo) => !todo.isCompleted),
      completed: filtered.filter((todo) => todo.isCompleted),
    };
  }, [labelId, todos]);

  const handleSaveLabel = async () => {
    if (!label || label.type !== "user") {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: "Label name is required",
        duration: 2500,
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedId = await updateLabelMutation({
        labelId,
        name: trimmedName,
        color,
      });

      if (updatedId) {
        toast({
          title: "✅ Label updated",
          duration: 2200,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Filters & Labels" navLink="/loggedin/filter-labels" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <div className="xl:px-40">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full border"
                style={{
                  backgroundColor: label?.color ?? "#6366f1",
                  borderColor: label?.color ?? "#6366f1",
                }}
              />
              <h1 className="text-lg font-semibold md:text-2xl">
                #{label?.name ?? "Label"}
              </h1>
            </div>
            <p className="text-sm text-foreground/70 mt-2 mb-4">
              Tasks filtered by this label.
            </p>
            {label?.type === "user" ? (
              <div className="mb-4 rounded-lg border bg-card p-3 text-card-foreground">
                <p className="mb-2 text-xs text-foreground/70">Edit label</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-9 max-w-xs"
                    placeholder="Label name"
                  />
                  <Input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-9 w-14 cursor-pointer p-1"
                  />
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveLabel}
                    className="h-9"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : null}

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
