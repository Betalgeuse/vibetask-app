import { Doc, Id } from "@/lib/supabase/types";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Calendar, ChevronDown, Flag, Hash, Tag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { useMemo, useState } from "react";
import Task from "../todos/task";
import { AddTaskWrapper } from "./add-task-button";
import SuggestMissingTasks from "./suggest-tasks";
import { useToast } from "../ui/use-toast";
import { PRIORITY_QUADRANT_META } from "@/lib/types/priority";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";

export default function AddTaskDialog({ data }: { data: Doc<"todos"> }) {
  const { taskName, description, projectId, labelId, priority, dueDate, _id } =
    data;
  const project = useQuery(api.projects.getProjectByProjectId, { projectId });
  const label = useQuery(api.labels.getLabelByLabelId, { labelId });
  const projects = useQuery(api.projects.getProjects) ?? [];
  const labels = useQuery(api.labels.getLabels) ?? [];
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const dialogMessages = messages.dialogs.taskDetails;

  const { toast } = useToast();

  const inCompletedSubtodosByProject: Array<Doc<"subTodos">> =
    useQuery(api.subTodos.inCompleteSubTodos, { parentId: _id }) ?? [];

  const completedSubtodosByProject: Array<Doc<"subTodos">> =
    useQuery(api.subTodos.completedSubTodos, { parentId: _id }) ?? [];

  const checkASubTodoMutation = useMutation(api.subTodos.checkASubTodo);
  const unCheckASubTodoMutation = useMutation(api.subTodos.unCheckASubTodo);
  const deleteASubTodoMutation = useMutation(api.subTodos.deleteASubTodo);

  const deleteATodoMutation = useMutation(api.todos.deleteATodo);
  const updateATodoProjectAndLabelMutation = useMutation(
    api.todos.updateATodoProjectAndLabel
  );

  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [isDeletingCompleted, setIsDeletingCompleted] = useState(false);

  const handleDeleteTodo = (e: any) => {
    e.preventDefault();
    const deletedId = deleteATodoMutation({ taskId: _id });
    if (deletedId !== undefined) {
      toast({
        title: dialogMessages.deletedSuccessTitle,
        duration: 3000,
      });
    }
  };

  const handleProjectChange = async (nextProjectId: string) => {
    const normalizedProjectId = nextProjectId.trim();
    if (
      !normalizedProjectId ||
      normalizedProjectId === projectId ||
      isSavingProject
    ) {
      setIsEditingProject(false);
      return;
    }

    setIsSavingProject(true);
    try {
      const updatedId = await updateATodoProjectAndLabelMutation({
        taskId: _id,
        projectId: normalizedProjectId as Id<"projects">,
      });

      if (updatedId) {
        toast({
          title: dialogMessages.projectUpdatedSuccessTitle,
          duration: 2200,
        });
      }
      setIsEditingProject(false);
    } catch (error) {
      console.error("Failed to update task project.", error);
      toast({
        title: dialogMessages.projectUpdatedFailureTitle,
        duration: 2500,
      });
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleLabelChange = async (nextLabelId: string) => {
    const normalizedLabelId = nextLabelId.trim();
    if (!normalizedLabelId || normalizedLabelId === labelId || isSavingLabel) {
      setIsEditingLabel(false);
      return;
    }

    setIsSavingLabel(true);
    try {
      const updatedId = await updateATodoProjectAndLabelMutation({
        taskId: _id,
        labelId: normalizedLabelId as Id<"labels">,
      });

      if (updatedId) {
        toast({
          title: dialogMessages.labelUpdatedSuccessTitle,
          duration: 2200,
        });
      }
      setIsEditingLabel(false);
    } catch (error) {
      console.error("Failed to update task label.", error);
      toast({
        title: dialogMessages.labelUpdatedFailureTitle,
        duration: 2500,
      });
    } finally {
      setIsSavingLabel(false);
    }
  };

  const handleDeleteCompletedSubTasks = async () => {
    if (isDeletingCompleted || completedSubtodosByProject.length === 0) {
      return;
    }

    setIsDeletingCompleted(true);

    try {
      await Promise.all(
        completedSubtodosByProject.map((task) =>
          deleteASubTodoMutation({ taskId: task._id })
        )
      );

      toast({
        title: dialogMessages.deleteCompletedSuccessTitle,
        duration: 2400,
      });
    } catch (error) {
      console.error("Failed to delete completed subtasks.", error);
      toast({
        title: dialogMessages.deleteCompletedFailureDescription,
        duration: 2800,
      });
    } finally {
      setIsDeletingCompleted(false);
    }
  };

  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden text-right md:w-full md:flex-row lg:h-4/6 lg:justify-between">
      <DialogHeader className="w-full min-h-0">
        <DialogTitle>{taskName}</DialogTitle>
        <DialogDescription className="min-h-0 overflow-y-auto pr-1">
          <p className="my-2 capitalize">{description}</p>
          <div className="flex items-center gap-1 mt-12 border-b-2 border-gray-100 pb-2 flex-wrap sm:justify-between lg:gap-0 ">
            <div className="flex gap-1">
              <ChevronDown className="w-5 h-5 text-primary" />
              <p className="font-bold flex text-sm text-gray-900">
                {dialogMessages.subTasks}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SuggestMissingTasks
                projectId={projectId}
                taskName={taskName}
                description={description}
                parentId={_id}
                isSubTask={true}
              />
              {completedSubtodosByProject.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteCompletedSubTasks();
                  }}
                  disabled={isDeletingCompleted}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingCompleted
                    ? dialogMessages.deleteCompletedLoading
                    : dialogMessages.deleteCompletedAction}
                </button>
              )}
            </div>
          </div>
          <div className="pl-4">
            {inCompletedSubtodosByProject.map((task) => {
              return (
                <Task
                  key={task._id}
                  data={task}
                  isCompleted={task.isCompleted}
                  handleOnChange={() =>
                    checkASubTodoMutation({ taskId: task._id })
                  }
                />
              );
            })}
            <div className="pb-4">
              <AddTaskWrapper parentTask={data} />
            </div>
            {completedSubtodosByProject.map((task) => {
              return (
                <Task
                  key={task._id}
                  data={task}
                  isCompleted={task.isCompleted}
                  handleOnChange={() =>
                    unCheckASubTodoMutation({ taskId: task._id })
                  }
                />
              );
            })}
          </div>
        </DialogDescription>
      </DialogHeader>
      <div className="flex max-h-[35vh] flex-col gap-2 overflow-y-auto bg-gray-100 md:max-h-full md:w-1/2">
        <div className="grid gap-2 p-4 border-b-2 w-full">
          <Label className="flex items-start">{dialogMessages.metadataProject}</Label>
          <div className="flex text-left items-center justify-start gap-2 pb-2">
            <Hash className="w-4 h-4 text-primary capitalize" />
            {isEditingProject ? (
              <select
                className="h-8 min-w-[180px] rounded-md border border-foreground/20 bg-background px-2 text-sm"
                value={projectId}
                onChange={(event) => {
                  void handleProjectChange(event.target.value);
                }}
                onBlur={() => setIsEditingProject(false)}
                disabled={isSavingProject}
                autoFocus
              >
                {!projects.some((item) => item._id === projectId) && project ? (
                  <option value={projectId}>{project.name}</option>
                ) : null}
                {projects.map((projectOption) => (
                  <option key={projectOption._id} value={projectOption._id}>
                    {projectOption.name}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                className="text-left text-sm underline-offset-4 hover:underline"
                onClick={() => setIsEditingProject(true)}
              >
                {project?.name || "—"}
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-2 p-4 border-b-2 w-full">
          <Label className="flex items-start">{dialogMessages.metadataDueDate}</Label>
          <div className="flex text-left items-center justify-start gap-2 pb-2">
            <Calendar className="w-4 h-4 text-primary capitalize" />
            <p className="text-sm">{format(dueDate || new Date(), "MMM dd yyyy")}</p>
          </div>
        </div>
        <div className="grid gap-2 p-4 border-b-2 w-full">
          <Label className="flex items-start">{dialogMessages.metadataPriority}</Label>
          <div className="flex text-left items-center justify-start gap-2 pb-2">
            <Flag className="w-4 h-4 text-primary capitalize" />
            <p className="text-sm">
              {priority ? PRIORITY_QUADRANT_META[priority].title : ""}
            </p>
          </div>
        </div>
        <div className="grid gap-2 p-4 border-b-2 w-full">
          <Label className="flex items-start">{dialogMessages.metadataLabel}</Label>
          <div className="flex text-left items-center justify-start gap-2 pb-2">
            <Tag className="w-4 h-4 text-primary capitalize" />
            {isEditingLabel ? (
              <select
                className="h-8 min-w-[180px] rounded-md border border-foreground/20 bg-background px-2 text-sm"
                value={labelId}
                onChange={(event) => {
                  void handleLabelChange(event.target.value);
                }}
                onBlur={() => setIsEditingLabel(false)}
                disabled={isSavingLabel}
                autoFocus
              >
                {!labels.some((item) => item._id === labelId) && label ? (
                  <option value={labelId}>{label.name}</option>
                ) : null}
                {labels.map((labelOption) => (
                  <option key={labelOption._id} value={labelOption._id}>
                    {labelOption.name}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                className="text-left text-sm underline-offset-4 hover:underline"
                onClick={() => setIsEditingLabel(true)}
              >
                {label?.name || "—"}
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 p-4 w-full justify-end">
          <form onSubmit={(e) => handleDeleteTodo(e)}>
            <button type="submit">
              <Trash2 className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </DialogContent>
  );
}
