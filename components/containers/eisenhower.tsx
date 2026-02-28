"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Doc } from "@/lib/supabase/types";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import QuickTaskInput from "../shared/quick-task-input";
import { Tag } from "lucide-react";
import {
  EISENHOWER_QUADRANT_META,
  EisenhowerQuadrantKey,
  getTodoStoredEisenhowerQuadrant,
  normalizeEisenhowerQuadrantKey,
} from "../kanban/metadata";
import ProjectionSwitcher from "../projection/projection-switcher";
import { useToast } from "../ui/use-toast";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center space-x-2 border-b-2 p-2 border-gray-100 animate-in fade-in">
      <div className="flex gap-2 w-full">
        <input
          type="checkbox"
          className="w-5 h-5 rounded-xl flex-shrink-0"
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

function DraggableTaskCard({ task, label, onCheck }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { taskId: task._id },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <TaskCard task={task} label={label} onCheck={onCheck} />
    </div>
  );
}

interface DroppableQuadrantProps {
  quadrantKey: EisenhowerQuadrantKey;
  title: string;
  subtitle: string;
  emptyStateText?: string;
  items: Array<Doc<"todos">>;
  labelsById: Map<string, Doc<"labels">>;
  onCheckTask: (task: Doc<"todos">) => void;
}

function DroppableQuadrant({
  quadrantKey,
  title,
  subtitle,
  emptyStateText = "No tasks",
  items,
  labelsById,
  onCheckTask,
}: DroppableQuadrantProps) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrantKey });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-card p-4 text-card-foreground shadow-sm min-h-[160px] transition-colors",
        isOver && "bg-primary/5 border-primary"
      )}
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
          items.map((task) => (
            <DraggableTaskCard
              key={task._id}
              task={task}
              label={labelsById.get(task.labelId) ?? null}
              onCheck={() => onCheckTask(task)}
            />
          ))
        ) : (
          <p className="text-sm text-foreground/60 py-2">{emptyStateText}</p>
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
  const [activeTask, setActiveTask] = useState<Doc<"todos"> | null>(null);

  const settings = useQuery(api.userFeatureSettings.getMySettings);
  const inCompleteTodosQuery = useQuery(api.todos.inCompleteTodos);
  const quadrantsQuery = useQuery(api.todos.inCompleteTodosByEisenhowerQuadrant);
  const labelsQuery = useQuery(api.labels.getLabels);
  const locale = normalizeAppLocale(settings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const eisenhowerMessages = messages.eisenhower;

  const checkATodo = useMutation(api.todos.checkATodo);
  const unCheckATodo = useMutation(api.todos.unCheckATodo);
  const updateTodoPriority = useAction(api.todos.updateTodoPriority);

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
        title: eisenhowerMessages.completedTitle,
        description: eisenhowerMessages.completedDescription,
        duration: 3000,
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const allTasks = Object.values(quadrants).flat();
    const task = allTasks.find((t) => t._id === taskId);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newQuadrant = over.id as EisenhowerQuadrantKey;

    const allTasks = Object.values(quadrants).flat();
    const task = allTasks.find((t) => t._id === taskId);
    if (!task) return;

    const currentQuadrant = getTodoStoredEisenhowerQuadrant(task) ?? "doFirst";
    if (currentQuadrant === newQuadrant) return;

    try {
      await updateTodoPriority({ taskId, priority: newQuadrant });
      toast({
        title: "Task moved",
        description: eisenhowerMessages.quadrants[newQuadrant].title,
        duration: 2000,
      });
    } catch {
      toast({
        title: "Failed to move task",
        description: "Please try again",
        duration: 3000,
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="xl:px-40">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-lg font-semibold md:text-2xl">
            {eisenhowerMessages.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <ProjectionSwitcher projectionKind="matrix" />
            <AddTaskWrapper />
          </div>
        </div>
        <p className="text-sm text-foreground/70 mt-2 mb-4">
          {eisenhowerMessages.description}
        </p>

        {isLoading && (
          <p className="text-sm text-foreground/60 mb-4">
            {eisenhowerMessages.loading}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {EISENHOWER_QUADRANT_META.map(({ key }) => (
            <DroppableQuadrant
              key={key}
              quadrantKey={key}
              title={eisenhowerMessages.quadrants[key].title}
              subtitle={eisenhowerMessages.quadrants[key].subtitle}
              emptyStateText={eisenhowerMessages.noTasks}
              items={quadrants[key]}
              labelsById={labelsById}
              onCheckTask={handleCheckTask}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80 rounded-lg border bg-card shadow-lg">
            <TaskCard
              task={activeTask}
              label={labelsById.get(activeTask.labelId) ?? null}
              onCheck={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
