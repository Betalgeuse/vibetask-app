"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/supabase/api";
import {
  invalidateSupabaseQueries,
  useMutation,
  useQuery,
} from "@/lib/supabase/hooks";
import type { PriorityQuadrant, TodoStatus } from "@/lib/types/priority";
import type { WorkflowStatus } from "@/lib/types/task-payload";

interface QuickTaskInputProps {
  defaultValues: {
    status?: TodoStatus;
    workflowStatus?: WorkflowStatus;
    priority?: PriorityQuadrant;
  };
  onSuccess?: () => void;
}

export default function QuickTaskInput({
  defaultValues,
  onSuccess,
}: QuickTaskInputProps) {
  const { toast } = useToast();

  const projects = useQuery(api.projects.getProjects) ?? [];
  const labels = useQuery(api.labels.getLabels) ?? [];
  const createATodo = useMutation(api.todos.createATodo);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const defaultProjectId =
    projects.find((project) => project.type === "user")?._id ??
    projects[0]?._id;
  const defaultLabelId =
    labels.find((label) => label.type === "user")?._id ?? labels[0]?._id;

  useEffect(() => {
    if (!isAdding) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isAdding]);

  useEffect(() => {
    if (!isAdding) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        !isLoading &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setTaskName("");
        setIsAdding(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAdding, isLoading]);

  const cancelAdd = () => {
    if (isLoading) {
      return;
    }

    setTaskName("");
    setIsAdding(false);
  };

  const submitTask = async () => {
    const trimmedTaskName = taskName.trim();

    if (!trimmedTaskName || isLoading) {
      return;
    }

    const dueDate = Date.now();
    const priority = defaultValues.priority ?? "doFirst";
    const status: TodoStatus =
      defaultValues.status ??
      (defaultValues.workflowStatus === "DONE" ? "DONE" : "TODO");
    const workflowStatus: WorkflowStatus =
      defaultValues.workflowStatus ??
      (status === "DONE" ? "DONE" : "BACKLOG");

    setIsLoading(true);

    try {
      await createATodo({
        taskName: trimmedTaskName,
        dueDate,
        projectId: defaultProjectId,
        labelId: defaultLabelId,
        priority,
        status,
        workflowStatus,
        payload: {
          name: trimmedTaskName,
          dueDate,
          priorityQuadrant: priority,
          workflowStatus,
        },
      });

      setTaskName("");
      setIsAdding(true);
      invalidateSupabaseQueries();
      onSuccess?.();

      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create task.";

      toast({
        title: "Could not add task",
        description: message,
        duration: 3500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitTask();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    cancelAdd();
  };

  if (!isAdding) {
    return (
      <div ref={containerRef} className="pt-2">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>Add task</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="pt-2">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          ref={inputRef}
          value={taskName}
          disabled={isLoading}
          onChange={(event) => setTaskName(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Quick add task"
          className="h-9 w-full min-w-0"
        />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !taskName.trim()}
            className="h-9 flex-1 sm:flex-none"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isLoading}
            onClick={cancelAdd}
            aria-label="Cancel quick add"
            className="h-9 w-9 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
