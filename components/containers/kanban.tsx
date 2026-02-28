"use client";

import { useMemo, useState } from "react";

import { api } from "@/lib/supabase/api";
import { useQuery, useAction } from "@/lib/supabase/hooks";
import { Doc } from "@/lib/supabase/types";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import KanbanColumn from "../kanban/kanban-column";
import {
  KANBAN_COLUMN_META,
  KanbanColumnKey,
  getTodoStoredKanbanColumn,
} from "../kanban/metadata";
import ProjectionSwitcher from "../projection/projection-switcher";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { TodoStatus } from "@/lib/types/priority";
import { WorkflowStatus } from "@/lib/types/task-payload";
import { useToast } from "../ui/use-toast";
import Task from "../todos/task";

type KanbanTodos = Record<KanbanColumnKey, Array<Doc<"todos">>>;

const createEmptyColumns = (): KanbanTodos => ({
  TODO: [],
  IN_PROGRESS: [],
  DONE: [],
});

function groupTodosByKanbanColumn(todos: Array<Doc<"todos">>): KanbanTodos {
  return todos.reduce<KanbanTodos>((acc, todo) => {
    const storedColumn = getTodoStoredKanbanColumn(todo);
    const column = storedColumn ?? (todo.isCompleted ? "DONE" : "TODO");

    acc[column].push(todo);
    return acc;
  }, createEmptyColumns());
}

const COLUMN_WORKFLOW_STATUS: Record<KanbanColumnKey, WorkflowStatus> = {
  TODO: "BACKLOG",
  IN_PROGRESS: "THIS_WEEK",
  DONE: "DONE",
};

export default function Kanban() {
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState<Doc<"todos"> | null>(null);
  const settings = useQuery(api.userFeatureSettings.getMySettings);
  const inCompleteTodosQuery = useQuery(api.todos.inCompleteTodos);
  const completedTodosQuery = useQuery(api.todos.completedTodos);
  const locale = normalizeAppLocale(settings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const kanbanMessages = messages.kanban;

  const updateTodoStatus = useAction(api.todos.updateTodoStatus);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const allTodos = useMemo(() => {
    if (!inCompleteTodosQuery || !completedTodosQuery) {
      return [] as Array<Doc<"todos">>;
    }

    return [...inCompleteTodosQuery, ...completedTodosQuery];
  }, [inCompleteTodosQuery, completedTodosQuery]);

  const columns = useMemo(() => {
    if (!allTodos.length) {
      return createEmptyColumns();
    }

    return groupTodosByKanbanColumn(allTodos);
  }, [allTodos]);

  const isLoading =
    inCompleteTodosQuery === undefined || completedTodosQuery === undefined;

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    const task = allTodos.find((t) => t._id === taskId);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      return;
    }

    const taskId = active.id as string;
    const newColumn = over.id as KanbanColumnKey;

    const task = allTodos.find((t) => t._id === taskId);
    if (!task) {
      return;
    }

    const currentColumn = getTodoStoredKanbanColumn(task) ?? (task.isCompleted ? "DONE" : "TODO");

    if (currentColumn === newColumn) {
      return;
    }

    try {
      await updateTodoStatus({
        taskId,
        status: newColumn,
        workflowStatus: COLUMN_WORKFLOW_STATUS[newColumn],
      });
      toast({
        title: "Task moved",
        description: `Moved to ${kanbanMessages.columns[newColumn].title}`,
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to move task:", error);
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
          <h1 className="text-lg font-semibold md:text-2xl">{kanbanMessages.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <ProjectionSwitcher projectionKind="kanban" />
            <AddTaskWrapper />
          </div>
        </div>
        <p className="text-sm text-foreground/70 mt-2 mb-4">
          {kanbanMessages.description}
        </p>

        {isLoading && (
          <p className="text-sm text-foreground/60 mb-4">{kanbanMessages.loading}</p>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {KANBAN_COLUMN_META.map(({ key }) => (
            <KanbanColumn
              key={key}
              column={key}
              title={kanbanMessages.columns[key].title}
              subtitle={kanbanMessages.columns[key].subtitle}
              emptyStateText={kanbanMessages.noTasks}
              items={columns[key]}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80">
            <Task
              data={activeTask}
              isCompleted={activeTask.isCompleted}
              handleOnChange={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
