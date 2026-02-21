"use client";

import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import Todos from "../todos/todos";

type EisenhowerQuadrant = "doFirst" | "schedule" | "delegate" | "eliminate";

type EisenhowerTodos = Record<EisenhowerQuadrant, Array<Doc<"todos">>>;

const EMPTY_QUADRANTS: EisenhowerTodos = {
  doFirst: [],
  schedule: [],
  delegate: [],
  eliminate: [],
};

const QUADRANT_META: Array<{
  key: EisenhowerQuadrant;
  title: string;
  subtitle: string;
}> = [
  {
    key: "doFirst",
    title: "Do First",
    subtitle: "Urgent + Important",
  },
  {
    key: "schedule",
    title: "Schedule",
    subtitle: "Not Urgent + Important",
  },
  {
    key: "delegate",
    title: "Delegate",
    subtitle: "Urgent + Not Important",
  },
  {
    key: "eliminate",
    title: "Eliminate",
    subtitle: "Not Urgent + Not Important",
  },
];

export default function Eisenhower() {
  const quadrantsQuery = useQuery(api.todos.inCompleteTodosByEisenhowerQuadrant);
  const quadrants = quadrantsQuery ?? EMPTY_QUADRANTS;

  return (
    <div className="xl:px-40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold md:text-2xl">Eisenhower Matrix</h1>
        <AddTaskWrapper />
      </div>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Grouped by urgency (due today/overdue) and importance (priority 1-2).
      </p>

      {quadrantsQuery === undefined && (
        <p className="text-sm text-foreground/60 mb-4">Loading matrix...</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANT_META.map(({ key, title, subtitle }) => {
          const items = quadrants[key];
          return (
            <section
              key={key}
              className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <h2 className="text-base font-semibold">{title}</h2>
                  <p className="text-xs text-foreground/70">{subtitle}</p>
                </div>
                <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-1">
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
        })}
      </div>
    </div>
  );
}
