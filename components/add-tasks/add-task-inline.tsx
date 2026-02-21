"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { CalendarIcon, Text } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { CardFooter } from "../ui/card";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
import moment from "moment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Doc, Id } from "@/lib/supabase/types";
import { useAction, useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import {
  PriorityQuadrant,
  createFallbackPrioritySuggestion,
  normalizePriorityQuadrant,
  PRIORITY_QUADRANT_OPTIONS,
} from "@/lib/ai/priority";
import { suggestPriorityForTask } from "@/lib/ai/suggest-priority";
import PrioritySuggestionDialog from "./priority-suggestion-dialog";
import {
  DEFAULT_TASK_MODULE_FLAGS,
  WORKFLOW_STATUSES,
  normalizeWorkflowStatus,
  type TaskPayload,
} from "@/lib/types/task-payload";

const FormSchema = z.object({
  taskName: z.string().min(2, {
    message: "Task name must be at least 2 characters.",
  }),
  description: z.string().optional().default(""),
  story: z.string().optional().default(""),
  dueDate: z.date({ required_error: "A due date is required" }),
  priority: z.string().optional().default(""),
  workload: z.string().optional().default(""),
  workflowStatus: z.string().optional().default("BACKLOG"),
  epicId: z.string().optional().default(""),
  personaId: z.string().optional().default(""),
  projectId: z.string().min(1, { message: "Please select a Project" }),
  labelId: z.string().min(1, { message: "Please select a Label" }),
});

type AddTaskFormValues = z.infer<typeof FormSchema>;

export default function AddTaskInline({
  setShowAddTask,
  parentTask,
  projectId: myProjectId,
}: {
  setShowAddTask: Dispatch<SetStateAction<boolean>>;
  parentTask?: Doc<"todos">;
  projectId?: Id<"projects">;
}) {
  const projects = useQuery(api.projects.getProjects) ?? [];
  const labels = useQuery(api.labels.getLabels) ?? [];
  const epics = useQuery(api.epics.getEpics) ?? [];
  const personas = useQuery(api.personas.getPersonas) ?? [];
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const enabledModules =
    featureSettings?.enabledModules ?? DEFAULT_TASK_MODULE_FLAGS;

  const defaultProjectId =
    myProjectId || parentTask?.projectId || projects[0]?._id || "";
  const defaultLabelId = parentTask?.labelId || labels[0]?._id || "";
  const defaultEpicId = parentTask?.epicId || epics[0]?._id || "";
  const defaultPersonaId = parentTask?.personaId || personas[0]?._id || "";
  const priority = parentTask?.priority?.toString() || "";
  const parentId = parentTask?._id;

  const { toast } = useToast();

  const createASubTodoEmbeddings = useAction(
    api.subTodos.createSubTodoAndEmbeddings
  );

  const createTodoEmbeddings = useAction(api.todos.createTodoAndEmbeddings);

  const defaultValues: AddTaskFormValues = {
    taskName: "",
    description: "",
    story: parentTask?.story || "",
    priority,
    workload: parentTask?.workload?.toString() || "",
    workflowStatus: parentTask?.workflowStatus || "BACKLOG",
    epicId: defaultEpicId,
    personaId: defaultPersonaId,
    dueDate: new Date(),
    projectId: defaultProjectId,
    labelId: defaultLabelId,
  };

  const form = useForm<AddTaskFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  });

  const [pendingTaskData, setPendingTaskData] =
    useState<AddTaskFormValues | null>(null);
  const [prioritySuggestionOpen, setPrioritySuggestionOpen] = useState(false);
  const [isResolvingPriority, setIsResolvingPriority] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [suggestedPriority, setSuggestedPriority] =
    useState<ReturnType<typeof createFallbackPrioritySuggestion> | null>(null);

  useEffect(() => {
    const selectedProjectId = form.getValues("projectId");
    if (!selectedProjectId && defaultProjectId) {
      form.setValue("projectId", defaultProjectId);
    }
  }, [defaultProjectId, form]);

  useEffect(() => {
    const selectedLabelId = form.getValues("labelId");
    if (!selectedLabelId && defaultLabelId) {
      form.setValue("labelId", defaultLabelId);
    }
  }, [defaultLabelId, form]);

  useEffect(() => {
    if (!enabledModules.epic) {
      form.setValue("epicId", "");
      return;
    }

    const selectedEpicId = form.getValues("epicId");
    if (!selectedEpicId && defaultEpicId) {
      form.setValue("epicId", defaultEpicId);
    }
  }, [defaultEpicId, enabledModules.epic, form]);

  useEffect(() => {
    if (!enabledModules.persona) {
      form.setValue("personaId", "");
      return;
    }

    const selectedPersonaId = form.getValues("personaId");
    if (!selectedPersonaId && defaultPersonaId) {
      form.setValue("personaId", defaultPersonaId);
    }
  }, [defaultPersonaId, enabledModules.persona, form]);

  async function createTaskWithPriority(
    data: AddTaskFormValues,
    resolvedPriority: PriorityQuadrant
  ) {
    const {
      taskName,
      description,
      story,
      dueDate,
      projectId,
      labelId,
      epicId,
      personaId,
      workload,
      workflowStatus,
    } = data;

    if (!projectId || !labelId) {
      return;
    }

    const parsedWorkload =
      enabledModules.workload && workload?.trim()
        ? Number.parseInt(workload, 10)
        : undefined;
    const normalizedWorkload =
      typeof parsedWorkload === "number" &&
      Number.isFinite(parsedWorkload) &&
      parsedWorkload > 0
        ? parsedWorkload
        : undefined;

    const normalizedWorkflowStatus = enabledModules.workflowStatus
      ? normalizeWorkflowStatus(workflowStatus, "BACKLOG")
      : undefined;

    const payload: TaskPayload = {
      name: taskName,
      description: description || undefined,
      story: enabledModules.story ? story || undefined : undefined,
      priorityQuadrant: resolvedPriority,
      dueDate: moment(dueDate).valueOf(),
      workload: normalizedWorkload,
      workflowStatus: normalizedWorkflowStatus,
      epicId: enabledModules.epic ? epicId || undefined : undefined,
      personaId: enabledModules.persona ? personaId || undefined : undefined,
    };

    setIsSavingTask(true);

    try {
      if (parentId) {
        await createASubTodoEmbeddings({
          parentId,
          taskName,
          description,
          story: enabledModules.story ? story || undefined : undefined,
          priority: resolvedPriority,
          workflowStatus: normalizedWorkflowStatus,
          workload: normalizedWorkload,
          epicId:
            enabledModules.epic && epicId
              ? (epicId as Id<"epics">)
              : undefined,
          personaId:
            enabledModules.persona && personaId
              ? (personaId as Id<"personas">)
              : undefined,
          dueDate: moment(dueDate).valueOf(),
          projectId: projectId as Id<"projects">,
          labelId: labelId as Id<"labels">,
          payload,
        });
      } else {
        await createTodoEmbeddings({
          taskName,
          description,
          story: enabledModules.story ? story || undefined : undefined,
          priority: resolvedPriority,
          workflowStatus: normalizedWorkflowStatus,
          workload: normalizedWorkload,
          epicId:
            enabledModules.epic && epicId
              ? (epicId as Id<"epics">)
              : undefined,
          personaId:
            enabledModules.persona && personaId
              ? (personaId as Id<"personas">)
              : undefined,
          dueDate: moment(dueDate).valueOf(),
          projectId: projectId as Id<"projects">,
          labelId: labelId as Id<"labels">,
          payload,
        });
      }

      toast({
        title: "🦄 Created a task!",
        duration: 3000,
      });

      setPendingTaskData(null);
      setSuggestedPriority(null);
      setPrioritySuggestionOpen(false);
      form.reset({ ...defaultValues });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create task.";

      toast({
        title: "Could not create task",
        description: message,
        duration: 3500,
      });
    } finally {
      setIsSavingTask(false);
    }
  }

  async function onConfirmSuggestedPriority(quadrant: PriorityQuadrant) {
    if (!pendingTaskData) {
      return;
    }

    await createTaskWithPriority(pendingTaskData, quadrant);
  }

  async function onSubmit(data: AddTaskFormValues) {
    const selectedPriority = data.priority?.trim();

    if (selectedPriority) {
      const normalizedPriority = normalizePriorityQuadrant(selectedPriority);
      if (!normalizedPriority) {
        toast({
          title: "Could not resolve priority",
          description: "Please choose a valid priority quadrant.",
          duration: 3000,
        });
        return;
      }
      await createTaskWithPriority(data, normalizedPriority);
      return;
    }

    setIsResolvingPriority(true);

    try {
      const suggestion = await suggestPriorityForTask({
        taskName: data.taskName,
        description: data.description,
        dueDate: moment(data.dueDate).valueOf(),
        projectId: data.projectId,
      });

      setPendingTaskData(data);
      setSuggestedPriority(suggestion);
      setPrioritySuggestionOpen(true);

      if (suggestion.usedFallback) {
        toast({
          title: "Using default priority suggestion",
          description: suggestion.reason,
          duration: 3000,
        });
      }
    } catch (_error) {
      const fallback = createFallbackPrioritySuggestion(
        "AI suggestion failed. Using default priority suggestion."
      );
      setPendingTaskData(data);
      setSuggestedPriority(fallback);
      setPrioritySuggestionOpen(true);
    } finally {
      setIsResolvingPriority(false);
    }
  }

  const isSubmitting = isResolvingPriority || isSavingTask;

  return (
    <div>
      <PrioritySuggestionDialog
        open={prioritySuggestionOpen}
        suggestion={suggestedPriority}
        isSubmitting={isSavingTask}
        onOpenChange={(open) => {
          setPrioritySuggestionOpen(open);
          if (!open && !isSavingTask) {
            setPendingTaskData(null);
            setSuggestedPriority(null);
          }
        }}
        onConfirm={onConfirmSuggestedPriority}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-2 border-2 p-2 border-gray-200 my-2 rounded-xl px-3 pt-4 border-foreground/20"
        >
          <FormField
            control={form.control}
            name="taskName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    id="taskName"
                    type="text"
                    placeholder="Enter your Task name"
                    required
                    className="border-0 font-semibold text-lg"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex items-start gap-2">
                    <Text className="ml-auto h-4 w-4 opacity-50" />
                    <Textarea
                      id="description"
                      placeholder="Description"
                      className="resize-none"
                      {...field}
                    />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
          {enabledModules.story && (
            <FormField
              control={form.control}
              name="story"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      id="story"
                      placeholder="Story / context (optional)"
                      className="resize-none min-h-20"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "flex gap-2 w-[240px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                    value={field.value?.trim() ? field.value : "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No priority (use AI)</SelectItem>
                      {PRIORITY_QUADRANT_OPTIONS.map(
                        ({ quadrant, label, subtitle }) => (
                          <SelectItem key={quadrant} value={quadrant}>
                            {label} — {subtitle}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="labelId"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Label" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {labels.map((label: Doc<"labels">, idx: number) => (
                        <SelectItem key={idx} value={label._id}>
                          {label?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Project" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projects.map((project: Doc<"projects">, idx: number) => (
                      <SelectItem key={idx} value={project._id}>
                        {project?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <FormMessage />
              </FormItem>
            )}
          />
          {(enabledModules.persona ||
            enabledModules.epic ||
            enabledModules.workload ||
            enabledModules.workflowStatus) && (
            <div className="grid gap-2 md:grid-cols-2">
              {enabledModules.persona && (
                <FormField
                  control={form.control}
                  name="personaId"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? "" : value)
                        }
                        value={field.value?.trim() ? field.value : "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Persona (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {personas.map((persona) => (
                            <SelectItem key={persona._id} value={persona._id}>
                              {persona.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {enabledModules.epic && (
                <FormField
                  control={form.control}
                  name="epicId"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? "" : value)
                        }
                        value={field.value?.trim() ? field.value : "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Epic (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {epics.map((epic) => (
                            <SelectItem key={epic._id} value={epic._id}>
                              {epic.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {enabledModules.workload && (
                <FormField
                  control={form.control}
                  name="workload"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          placeholder="Workload (1-100)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {enabledModules.workflowStatus && (
                <FormField
                  control={form.control}
                  name="workflowStatus"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "BACKLOG"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Workflow status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WORKFLOW_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}
          <CardFooter className="flex flex-col lg:flex-row lg:justify-between gap-2 border-t-2 pt-3">
            <div className="w-full lg:w-1/4"></div>
            <div className="flex gap-3 self-end">
              <Button
                className="bg-gray-300/40 text-gray-950 px-6 hover:bg-gray-300"
                variant={"outline"}
                type="button"
                onClick={() => setShowAddTask(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button className="px-6" type="submit" disabled={isSubmitting}>
                {isResolvingPriority ? "Checking priority..." : "Add task"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Form>
    </div>
  );
}
