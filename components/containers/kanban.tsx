"use client";

import { useMemo } from "react";

import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
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

export default function Kanban() {
  const settings = useQuery(api.userFeatureSettings.getMySettings);
  const inCompleteTodosQuery = useQuery(api.todos.inCompleteTodos);
  const completedTodosQuery = useQuery(api.todos.completedTodos);
  const locale = normalizeAppLocale(settings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const kanbanMessages = messages.kanban;

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

  return (
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
  );
}
