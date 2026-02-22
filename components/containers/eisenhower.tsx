"use client";

import { useMemo } from "react";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Doc } from "@/lib/supabase/types";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import QuickTaskInput from "../shared/quick-task-input";
import { Tag } from "lucide-react";
import {
  EISENHOWER_QUADRANT_META,
  EisenhowerQuadrantKey,
  getTodoStoredEisenhowerQuadrant,
  normalizeEisenhowerQuadrantKey,
} from "../kanban/metadata";
import { useToast } from "../ui/use-toast";

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

interface TaskCardProps {
  task: Doc<"todos">;
  label?: Doc<"labels"> | null;
  onCheck: () => void;
}

function TaskCard({ task, label, onCheck }: TaskCardProps) {
  return (
    <div
      className="flex items-center space-x-2 border-b-2 p-2 border-gray-100 animate-in fade-in"
    >
      <div className="flex gap-2 w-full">
        <input
          type="checkbox"
          className="w-5 h-5 rounded-xl"
          checked={task.isCompleted}
          onChange={onCheck}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex flex-col items-start">
          <span
            className={`text-sm font-normal text-left ${
              task.isCompleted ? "line-through text-foreground/30" : ""
            }`}
          >
            {task.taskName}
          </span>
          {label ? (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{
                borderColor: label.color,
                color: label.color,
              }}
            >
              <Tag className="h-3 w-3" />
              {label.name}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface DroppableQuadrantProps {
  quadrantKey: EisenhowerQuadrantKey;
  title: string;
  subtitle: string;
  items: Array<Doc<"todos">>;
  labelsById: Map<string, Doc<"labels">>;
  onCheckTask: (task: Doc<"todos">) => void;
}

function DroppableQuadrant({
  quadrantKey,
  title,
  subtitle,
  items,
  labelsById,
  onCheckTask,
}: DroppableQuadrantProps) {
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-foreground/70">{subtitle}</p>
        </div>
        <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-1">
          {items.length}
        </span>
      </div>

      <div className="pt-2 min-h-[100px]">
        {items.length > 0 ? (
          items.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              label={labelsById.get(task.labelId) ?? null}
              onCheck={() => onCheckTask(task)}
            />
          ))
        ) : (
          <p className="text-sm text-foreground/60 py-2">No tasks</p>
        )}
        <div className="pt-2">
          <QuickTaskInput defaultValues={{ priority: quadrantKey }} />
        </div>
      </div>
    </section>
  );
}

export default function Eisenhower() {
  const { toast } = useToast();

  const inCompleteTodosQuery = useQuery(api.todos.inCompleteTodos);
  const quadrantsQuery = useQuery(api.todos.inCompleteTodosByEisenhowerQuadrant);
  const labelsQuery = useQuery(api.labels.getLabels);

  const checkATodo = useMutation(api.todos.checkATodo);
  const unCheckATodo = useMutation(api.todos.unCheckATodo);

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

  const labelsById = useMemo(
    () => new Map((labelsQuery ?? []).map((label) => [label._id, label])),
    [labelsQuery]
  );

  const isLoading = inCompleteTodosQuery === undefined && quadrantsQuery === undefined;

  const handleCheckTask = async (task: Doc<"todos">) => {
    if (task.isCompleted) {
      await unCheckATodo({ taskId: task._id });
    } else {
      await checkATodo({ taskId: task._id });
      toast({
        title: "✅ Task completed",
        description: "You're a rockstar",
        duration: 3000,
      });
    }
  };

  return (
    <div className="xl:px-40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold md:text-2xl">Eisenhower Matrix</h1>
        <AddTaskWrapper />
      </div>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Tasks are grouped by priority quadrant.
      </p>

      {isLoading && <p className="text-sm text-foreground/60 mb-4">Loading matrix...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {EISENHOWER_QUADRANT_META.map(({ key, title, subtitle }) => {
          const items = quadrants[key];
          return (
            <DroppableQuadrant
              key={key}
              quadrantKey={key}
              title={title}
              subtitle={subtitle}
              items={items}
              labelsById={labelsById}
              onCheckTask={handleCheckTask}
            />
          );
        })}
      </div>
    </div>
  );
}
