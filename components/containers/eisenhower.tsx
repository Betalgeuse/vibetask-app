"use client";

import { useMemo } from "react";

import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import { Doc } from "@/lib/supabase/types";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import {
  EISENHOWER_QUADRANT_META,
  EisenhowerQuadrantKey,
  getTodoStoredEisenhowerQuadrant,
  normalizeEisenhowerQuadrantKey,
} from "../kanban/metadata";
import Todos from "../todos/todos";

type EisenhowerTodos = Record<EisenhowerQuadrantKey, Array<Doc<"todos">>>;

const createEmptyQuadrants = (): EisenhowerTodos => ({
  doFirst: [],
  schedule: [],
  delegate: [],
  eliminate: [],
});

function normalizeQuadrantBuckets(quadrants: unknown): EisenhowerTodos {
  const normalized = createEmptyQuadrants();

  if (!quadrants || typeof quadrants !== "object") {
    return normalized;
  }

  Object.entries(quadrants as Record<string, unknown>).forEach(
    ([rawQuadrantKey, rawTodos]) => {
      const quadrantKey = normalizeEisenhowerQuadrantKey(rawQuadrantKey);

      if (!quadrantKey || !Array.isArray(rawTodos)) {
        return;
      }

      normalized[quadrantKey] = rawTodos as Array<Doc<"todos">>;
    }
  );

  return normalized;
}

function countQuadrantItems(quadrants: EisenhowerTodos) {
  return Object.values(quadrants).reduce((total, items) => total + items.length, 0);
}

export default function Eisenhower() {
  const inCompleteTodosQuery = useQuery(api.todos.inCompleteTodos);
  const quadrantsQuery = useQuery(api.todos.inCompleteTodosByEisenhowerQuadrant);

  const legacyQuadrants = useMemo(
    () => normalizeQuadrantBuckets(quadrantsQuery),
    [quadrantsQuery]
  );

  const quadrants = useMemo(() => {
    if (!inCompleteTodosQuery) {
      return legacyQuadrants;
    }

    const fallbackQuadrantByTodoId = new Map<string, EisenhowerQuadrantKey>();

    (Object.keys(legacyQuadrants) as Array<EisenhowerQuadrantKey>).forEach(
      (quadrantKey) => {
        legacyQuadrants[quadrantKey].forEach((todo) => {
          fallbackQuadrantByTodoId.set(todo._id, quadrantKey);
        });
      }
    );

    let hasStoredQuadrant = false;

    const groupedByStoredQuadrants = inCompleteTodosQuery.reduce<EisenhowerTodos>(
      (acc, todo) => {
        const storedQuadrant = getTodoStoredEisenhowerQuadrant(todo);
        if (storedQuadrant) {
          hasStoredQuadrant = true;
        }

        const resolvedQuadrant =
          storedQuadrant ?? fallbackQuadrantByTodoId.get(todo._id) ?? "doFirst";

        acc[resolvedQuadrant].push(todo);
        return acc;
      },
      createEmptyQuadrants()
    );

    const legacyItemCount = countQuadrantItems(legacyQuadrants);

    if (hasStoredQuadrant || legacyItemCount === 0) {
      return groupedByStoredQuadrants;
    }

    return legacyQuadrants;
  }, [inCompleteTodosQuery, legacyQuadrants]);

  const isLoading = inCompleteTodosQuery === undefined && quadrantsQuery === undefined;

  return (
    <div className="xl:px-40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold md:text-2xl">Eisenhower Matrix</h1>
        <AddTaskWrapper />
      </div>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Grouped by each task&apos;s saved Eisenhower quadrant.
      </p>

      {isLoading && <p className="text-sm text-foreground/60 mb-4">Loading matrix...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {EISENHOWER_QUADRANT_META.map(({ key, title, subtitle }) => {
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
