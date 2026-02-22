"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCenter,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useQuery, useMutation, invalidateSupabaseQueries } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Doc } from "@/lib/supabase/types";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import {
  EISENHOWER_QUADRANT_META,
  EisenhowerQuadrantKey,
  getTodoStoredEisenhowerQuadrant,
  normalizeEisenhowerQuadrantKey,
} from "../kanban/metadata";
import { useToast } from "../ui/use-toast";
import type { PriorityQuadrant } from "@/lib/types/priority";

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

interface DraggableTaskProps {
  task: Doc<"todos">;
  onCheck: () => void;
}

function DraggableTask({ task, onCheck }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center space-x-2 border-b-2 p-2 border-gray-100 animate-in fade-in cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
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
        </div>
      </div>
    </div>
  );
}

interface DroppableQuadrantProps {
  id: EisenhowerQuadrantKey;
  title: string;
  subtitle: string;
  items: Array<Doc<"todos">>;
  onCheckTask: (task: Doc<"todos">) => void;
  isOver: boolean;
}

function DroppableQuadrant({
  id,
  title,
  subtitle,
  items,
  onCheckTask,
  isOver,
}: DroppableQuadrantProps) {
  const { setNodeRef } = useDroppable({
    id,
    data: { quadrant: id },
  });

  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors ${
        isOver ? "bg-primary/5 border-primary" : ""
      }`}
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

      <div className="pt-2 min-h-[100px]">
        {items.length > 0 ? (
          items.map((task) => (
            <DraggableTask
              key={task._id}
              task={task}
              onCheck={() => onCheckTask(task)}
            />
          ))
        ) : (
          <p className="text-sm text-foreground/60 py-2">No tasks</p>
        )}
      </div>
    </section>
  );
}

export default function Eisenhower() {
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState<Doc<"todos"> | null>(null);
  const [overQuadrant, setOverQuadrant] = useState<EisenhowerQuadrantKey | null>(null);

  const inCompleteTodosQuery = useQuery(api.todos.inCompleteTodos);
  const quadrantsQuery = useQuery(api.todos.inCompleteTodosByEisenhowerQuadrant);

  const checkATodo = useMutation(api.todos.checkATodo);
  const unCheckATodo = useMutation(api.todos.unCheckATodo);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id);
    const task = inCompleteTodosQuery?.find((t) => t._id === taskId);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) {
      const quadrantId = String(event.over.id) as EisenhowerQuadrantKey;
      if (EISENHOWER_QUADRANT_META.some((q) => q.key === quadrantId)) {
        setOverQuadrant(quadrantId);
      }
    } else {
      setOverQuadrant(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverQuadrant(null);

    if (!over) return;

    const taskId = String(active.id);
    const newQuadrant = String(over.id) as PriorityQuadrant;

    if (!EISENHOWER_QUADRANT_META.some((q) => q.key === newQuadrant)) return;

    try {
      await api.todos.updateTodoPriority({
        taskId,
        priority: newQuadrant,
      });

      invalidateSupabaseQueries();

      toast({
        title: "Task moved",
        description: `Task moved to ${EISENHOWER_QUADRANT_META.find((q) => q.key === newQuadrant)?.title}`,
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

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
        Drag and drop tasks between quadrants to change priority.
      </p>

      {isLoading && <p className="text-sm text-foreground/60 mb-4">Loading matrix...</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {EISENHOWER_QUADRANT_META.map(({ key, title, subtitle }) => {
            const items = quadrants[key];
            return (
              <DroppableQuadrant
                key={key}
                id={key}
                title={title}
                subtitle={subtitle}
                items={items}
                onCheckTask={handleCheckTask}
                isOver={overQuadrant === key}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="bg-card border-2 border-primary rounded-lg p-2 shadow-lg cursor-grabbing">
              <span className="text-sm font-normal">{activeTask.taskName}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
