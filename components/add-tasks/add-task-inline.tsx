"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { CustomFieldInput } from "@/components/custom-fields/custom-field-input";
import {
  buildCustomFieldDraftValues,
  buildCustomFieldUpsertInputs,
  type CustomFieldDraftValue,
  type CustomFieldDraftValues,
} from "@/components/custom-fields/custom-field-utils";
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
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
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
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import {
  DEFAULT_TASK_MODULE_FLAGS,
  WORKFLOW_STATUSES,
  normalizeWorkflowStatus,
  type TaskPayload,
} from "@/lib/types/task-payload";
import { type TaskEntityRef } from "@/lib/types/task-projection";

const FormSchema = z.object({
  taskName: z.string().min(2, {
    message: "Task name must be at least 2 characters.",
  }),
  description: z.string().optional().default(""),
  story: z.string().optional().default(""),
  dueDate: z.date().optional(),
  priority: z.string().optional().default(""),
  workload: z.string().optional().default(""),
  workflowStatus: z.string().optional().default("BACKLOG"),
  epicId: z.string().optional().default(""),
  personaId: z.string().optional().default(""),
  projectId: z.string().optional().default(""),
  labelName: z.string().optional().default(""),
});

type AddTaskFormValues = z.infer<typeof FormSchema>;

type PendingTaskData = {
  formValues: AddTaskFormValues;
  customFieldDrafts: CustomFieldDraftValues;
};

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase();
}

export default function AddTaskInline({
  setShowAddTask,
  parentTask,
  projectId: myProjectId,
}: {
  setShowAddTask: Dispatch<SetStateAction<boolean>>;
  parentTask?: Doc<"todos">;
  projectId?: Id<"projects">;
}) {
  const projectsQuery = useQuery(api.projects.getProjects);
  const labelsQuery = useQuery(api.labels.getLabels);
  const epicsQuery = useQuery(api.epics.getEpics);
  const personasQuery = useQuery(api.personas.getPersonas);
  const projects = useMemo(() => projectsQuery ?? [], [projectsQuery]);
  const labels = useMemo(() => labelsQuery ?? [], [labelsQuery]);
  const epics = useMemo(() => epicsQuery ?? [], [epicsQuery]);
  const personas = useMemo(() => personasQuery ?? [], [personasQuery]);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const enabledModules =
    featureSettings?.enabledModules ?? DEFAULT_TASK_MODULE_FLAGS;
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const taskMessages = messages.tasks;

  const defaultProjectId =
    myProjectId || parentTask?.projectId || projects[0]?._id || "";
  const defaultLabelId = parentTask?.labelId || labels[0]?._id || "";
  const defaultLabelName =
    parentTask?.labelId && labels.length > 0
      ? labels.find((label) => label._id === parentTask.labelId)?.name ?? ""
      : "";
  const defaultEpicId = parentTask?.epicId || epics[0]?._id || "";
  const defaultPersonaId = parentTask?.personaId || personas[0]?._id || "";
  const priority = parentTask?.priority?.toString() || "";
  const parentId = parentTask?._id;
  const taskKind: TaskEntityRef["taskKind"] = parentId ? "sub_todo" : "todo";
  const customFieldDefinitionsQuery = useQuery(
    api.customFields.getCustomFieldDefinitions,
    {
      appliesTo: taskKind,
    }
  );
  const customFieldDefinitions = useMemo(
    () => customFieldDefinitionsQuery ?? [],
    [customFieldDefinitionsQuery]
  );

  const { toast } = useToast();

  const createASubTodoEmbeddings = useAction(
    api.subTodos.createSubTodoAndEmbeddings
  );

  const createTodoEmbeddings = useAction(api.todos.createTodoAndEmbeddings);
  const createALabel = useAction(api.labels.createALabel);
  const upsertCustomFieldValues = useAction(api.customFields.upsertCustomFieldValues);

  const defaultValues: AddTaskFormValues = {
    taskName: "",
    description: "",
    story: parentTask?.story || "",
    priority,
    workload: parentTask?.workload?.toString() || "",
    workflowStatus: parentTask?.workflowStatus || "BACKLOG",
    epicId: defaultEpicId,
    personaId: defaultPersonaId,
    dueDate: undefined,
    projectId: defaultProjectId,
    labelName: defaultLabelName,
  };

  const form = useForm<AddTaskFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  });

  const [pendingTaskData, setPendingTaskData] = useState<PendingTaskData | null>(
    null
  );
  const [customFieldDrafts, setCustomFieldDrafts] =
    useState<CustomFieldDraftValues>({});
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
    const selectedLabelName = form.getValues("labelName");
    if (!selectedLabelName && defaultLabelName) {
      form.setValue("labelName", defaultLabelName);
    }
  }, [defaultLabelName, form]);

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

  useEffect(() => {
    setCustomFieldDrafts((previousDrafts) => {
      if (customFieldDefinitions.length === 0) {
        return {};
      }

      const emptyDrafts = buildCustomFieldDraftValues({
        definitions: customFieldDefinitions,
        values: [],
      });

      for (const definition of customFieldDefinitions) {
        if (definition._id in previousDrafts) {
          emptyDrafts[definition._id] = previousDrafts[definition._id];
        }
      }

      return emptyDrafts;
    });
  }, [customFieldDefinitions]);

  const labelsByName = useMemo(
    () =>
      new Map(
        labels.map((label) => [normalizeNameKey(label.name), label] as const)
      ),
    [labels]
  );

  const personasByName = useMemo(
    () =>
      new Map(
        personas.map((persona) => [normalizeNameKey(persona.name), persona] as const)
      ),
    [personas]
  );

  const epicsByName = useMemo(
    () =>
      new Map(epics.map((epic) => [normalizeNameKey(epic.name), epic] as const)),
    [epics]
  );

  async function resolveLabelIdFromInput(
    labelName: string | undefined
  ): Promise<Id<"labels"> | undefined> {
    const trimmedLabelName = labelName?.trim() ?? "";

    if (!trimmedLabelName) {
      return (defaultLabelId || labels[0]?._id || undefined) as
        | Id<"labels">
        | undefined;
    }

    const existingLabel = labelsByName.get(normalizeNameKey(trimmedLabelName));
    if (existingLabel) {
      return existingLabel._id as Id<"labels">;
    }

    const createdLabelId = await createALabel({ name: trimmedLabelName });
    if (!createdLabelId) {
      throw new Error(taskMessages.failedToCreateTaskDescription);
    }

    return createdLabelId as Id<"labels">;
  }

  function applyAiSuggestionToFormValues(
    data: AddTaskFormValues,
    suggestion: ReturnType<typeof createFallbackPrioritySuggestion>
  ): AddTaskFormValues {
    const nextValues: AddTaskFormValues = { ...data };

    if (!nextValues.labelName?.trim() && suggestion.suggestedLabelName?.trim()) {
      nextValues.labelName = suggestion.suggestedLabelName.trim();
    }

    if (
      enabledModules.persona &&
      !nextValues.personaId?.trim() &&
      suggestion.suggestedPersonaName?.trim()
    ) {
      const persona = personasByName.get(
        normalizeNameKey(suggestion.suggestedPersonaName)
      );
      if (persona) {
        nextValues.personaId = persona._id;
      }
    }

    if (
      enabledModules.epic &&
      !nextValues.epicId?.trim() &&
      suggestion.suggestedEpicName?.trim()
    ) {
      const epic = epicsByName.get(normalizeNameKey(suggestion.suggestedEpicName));
      if (epic) {
        nextValues.epicId = epic._id;
      }
    }

    if (
      enabledModules.story &&
      !nextValues.story?.trim() &&
      suggestion.suggestedStory?.trim()
    ) {
      nextValues.story = suggestion.suggestedStory.trim();
    }

    if (
      enabledModules.workload &&
      !nextValues.workload?.trim() &&
      typeof suggestion.suggestedWorkload === "number" &&
      Number.isFinite(suggestion.suggestedWorkload)
    ) {
      nextValues.workload = `${suggestion.suggestedWorkload}`;
    }

    if (
      enabledModules.workflowStatus &&
      !nextValues.workflowStatus?.trim() &&
      suggestion.suggestedWorkflowStatus
    ) {
      nextValues.workflowStatus = suggestion.suggestedWorkflowStatus;
    }

    return nextValues;
  }

  async function createTaskWithPriority(
    data: AddTaskFormValues,
    resolvedPriority: PriorityQuadrant,
    customFieldValues: CustomFieldDraftValues
  ) {
    const {
      taskName,
      description,
      story,
      dueDate,
      projectId,
      labelName,
      epicId,
      personaId,
      workload,
      workflowStatus,
    } = data;

    const resolvedProjectId =
      projectId?.trim() || defaultProjectId || projects[0]?._id || undefined;
    const resolvedLabelId = await resolveLabelIdFromInput(labelName);
    const resolvedDueDate =
      dueDate instanceof Date && !Number.isNaN(dueDate.getTime())
        ? moment(dueDate).valueOf()
        : Date.now();

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
      dueDate: resolvedDueDate,
      workload: normalizedWorkload,
      workflowStatus: normalizedWorkflowStatus,
      epicId: enabledModules.epic ? epicId || undefined : undefined,
      personaId: enabledModules.persona ? personaId || undefined : undefined,
    };

    setIsSavingTask(true);

    try {
      let createdTaskId: string | null = null;

      if (parentId) {
        createdTaskId = await createASubTodoEmbeddings({
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
          dueDate: resolvedDueDate,
          projectId: resolvedProjectId as Id<"projects"> | undefined,
          labelId: resolvedLabelId as Id<"labels"> | undefined,
          payload,
        });
      } else {
        createdTaskId = await createTodoEmbeddings({
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
          dueDate: resolvedDueDate,
          projectId: resolvedProjectId as Id<"projects"> | undefined,
          labelId: resolvedLabelId as Id<"labels"> | undefined,
          payload,
        });
      }

      const customFieldUpserts = buildCustomFieldUpsertInputs({
        definitions: customFieldDefinitions,
        drafts: customFieldValues,
      });

      if (createdTaskId && customFieldUpserts.length > 0) {
        try {
          await upsertCustomFieldValues({
            taskRef: {
              taskKind,
              taskId: createdTaskId,
            },
            values: customFieldUpserts,
          });
        } catch (customFieldError) {
          console.error(
            "Task created, but custom field values failed to save.",
            customFieldError
          );
        }
      }

      toast({
        title: taskMessages.taskCreatedTitle,
        duration: 3000,
      });

      setPendingTaskData(null);
      setSuggestedPriority(null);
      setPrioritySuggestionOpen(false);
      form.reset({ ...defaultValues });
      setCustomFieldDrafts(
        buildCustomFieldDraftValues({
          definitions: customFieldDefinitions,
          values: [],
        })
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : taskMessages.failedToCreateTaskDescription;

      toast({
        title: taskMessages.couldNotCreateTaskTitle,
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

    await createTaskWithPriority(
      pendingTaskData.formValues,
      quadrant,
      pendingTaskData.customFieldDrafts
    );
  }

  async function onSubmit(data: AddTaskFormValues) {
    const selectedPriority = data.priority?.trim();

    if (selectedPriority) {
      const normalizedPriority = normalizePriorityQuadrant(selectedPriority);
      if (!normalizedPriority) {
        toast({
          title: taskMessages.couldNotResolvePriorityTitle,
          description: taskMessages.invalidPriorityDescription,
          duration: 3000,
        });
        return;
      }
      await createTaskWithPriority(data, normalizedPriority, customFieldDrafts);
      return;
    }

    setIsResolvingPriority(true);

    try {
      const customFieldDraftSnapshot = { ...customFieldDrafts };
      const resolvedProjectId =
        data.projectId?.trim() || defaultProjectId || projects[0]?._id || undefined;
      const suggestion = await suggestPriorityForTask({
        taskName: data.taskName,
        description: data.description,
        dueDate:
          data.dueDate instanceof Date && !Number.isNaN(data.dueDate.getTime())
            ? moment(data.dueDate).valueOf()
            : undefined,
        projectId: resolvedProjectId,
        enabledModules,
        labelNames: labels.map((label) => label.name),
        personaNames: personas.map((persona) => persona.name),
        epicNames: epics.map((epic) => epic.name),
      });

      const nextValues = applyAiSuggestionToFormValues(data, suggestion);

      if (suggestion.usedFallback) {
        toast({
          title: taskMessages.fallbackPriorityTitle,
          description: suggestion.reason,
          duration: 3000,
        });
      }

      if (enabledModules.aiPriorityConfirmation) {
        setPendingTaskData({
          formValues: nextValues,
          customFieldDrafts: customFieldDraftSnapshot,
        });
        setSuggestedPriority(suggestion);
        setPrioritySuggestionOpen(true);
        return;
      }

      await createTaskWithPriority(
        nextValues,
        suggestion.quadrant,
        customFieldDraftSnapshot
      );
    } catch (_error) {
      const fallback = createFallbackPrioritySuggestion(
        taskMessages.fallbackPriorityDescription
      );
      const customFieldDraftSnapshot = { ...customFieldDrafts };
      const nextValues = applyAiSuggestionToFormValues(data, fallback);

      if (enabledModules.aiPriorityConfirmation) {
        setPendingTaskData({
          formValues: nextValues,
          customFieldDrafts: customFieldDraftSnapshot,
        });
        setSuggestedPriority(fallback);
        setPrioritySuggestionOpen(true);
      } else {
        await createTaskWithPriority(
          nextValues,
          fallback.quadrant,
          customFieldDraftSnapshot
        );
      }
    } finally {
      setIsResolvingPriority(false);
    }
  }

  function onCustomFieldDraftChange(
    fieldId: string,
    nextValue: CustomFieldDraftValue
  ) {
    setCustomFieldDrafts((previousDrafts) => ({
      ...previousDrafts,
      [fieldId]: nextValue,
    }));
  }

  const isSubmitting = isResolvingPriority || isSavingTask;

  return (
    <div>
      <PrioritySuggestionDialog
        open={prioritySuggestionOpen}
        suggestion={suggestedPriority}
        enabledModules={enabledModules}
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
          className="my-2 w-full max-w-full space-y-2 overflow-x-hidden rounded-xl border-2 border-foreground/20 border-gray-200 p-2 px-3 pt-4"
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
                    placeholder={taskMessages.taskNamePlaceholder}
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
                      placeholder={taskMessages.descriptionPlaceholder}
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
                      placeholder={taskMessages.storyPlaceholder}
                      className="resize-none min-h-20"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "flex w-full min-w-0 gap-2 pl-3 text-left font-normal sm:w-[240px]",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>{taskMessages.pickDate}</span>
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
                <FormItem className="w-full">
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                    value={field.value?.trim() ? field.value : "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={taskMessages.selectPriority} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{taskMessages.noPriority}</SelectItem>
                      {PRIORITY_QUADRANT_OPTIONS.map(
                        ({ quadrant }) => (
                          <SelectItem key={quadrant} value={quadrant}>
                            {taskMessages.priorityQuadrants[quadrant].title} —{" "}
                            {taskMessages.priorityQuadrants[quadrant].subtitle}
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
              name="labelName"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="라벨 (ex. 독서, AI, 네트워킹)"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        className="min-w-0 flex-1"
                      />
                      <Select
                        value={
                          (() => {
                            const labelValue = field.value?.trim();
                            if (!labelValue) {
                              return "none";
                            }

                            const matchedLabel = labelsByName.get(
                              normalizeNameKey(labelValue)
                            );
                            return matchedLabel?._id ?? "__manual__";
                          })()
                        }
                        onValueChange={(value) => {
                          if (value === "__manual__") {
                            return;
                          }

                          if (value === "none") {
                            field.onChange("");
                            return;
                          }

                          const selectedLabel = labels.find(
                            (label) => label._id === value
                          );
                          field.onChange(selectedLabel?.name ?? "");
                        }}
                      >
                        <SelectTrigger className="w-[132px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__manual__">
                            {taskMessages.manualLabelOption}
                          </SelectItem>
                          <SelectItem value="none">{taskMessages.noLabel}</SelectItem>
                          {labels.map((label: Doc<"labels">) => (
                            <SelectItem key={label._id} value={label._id}>
                              {label.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </FormControl>

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
                <Select
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? "" : value)
                  }
                  value={field.value?.trim() ? field.value : "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={taskMessages.selectProject} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">{taskMessages.noProject}</SelectItem>
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
                            <SelectValue placeholder={taskMessages.personaOptional} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{taskMessages.none}</SelectItem>
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
                            <SelectValue placeholder={taskMessages.epicOptional} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{taskMessages.none}</SelectItem>
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
                          placeholder={taskMessages.workloadPlaceholder}
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
                            <SelectValue
                              placeholder={taskMessages.workflowStatusPlaceholder}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WORKFLOW_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {taskMessages.workflowStatuses[status]}
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
          {customFieldDefinitions.length > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed border-foreground/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">
                {taskMessages.customFieldsTitle}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {customFieldDefinitions.map((definition) => (
                  <div key={definition._id} className="space-y-1">
                    <p className="text-xs font-medium text-foreground/80">
                      {definition.displayName}
                      {definition.isRequired ? " *" : ""}
                    </p>
                    {definition.fieldType === "boolean" ? (
                      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <CustomFieldInput
                          definition={definition}
                          value={customFieldDrafts[definition._id]}
                          onChange={(nextValue) =>
                            onCustomFieldDraftChange(definition._id, nextValue)
                          }
                          disabled={isSubmitting}
                        />
                        <span className="text-xs text-foreground/70">
                          {taskMessages.checked}
                        </span>
                      </label>
                    ) : (
                      <CustomFieldInput
                        definition={definition}
                        value={customFieldDrafts[definition._id]}
                        onChange={(nextValue) =>
                          onCustomFieldDraftChange(definition._id, nextValue)
                        }
                        disabled={isSubmitting}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <CardFooter className="flex flex-col gap-2 border-t-2 pt-3 sm:flex-row sm:justify-end">
            <Button
              className="w-full bg-gray-300/40 px-6 text-gray-950 hover:bg-gray-300 sm:w-auto"
              variant={"outline"}
              type="button"
              onClick={() => setShowAddTask(false)}
              disabled={isSubmitting}
            >
              {taskMessages.cancel}
            </Button>
            <Button
              className="w-full px-6 sm:w-auto"
              type="submit"
              disabled={isSubmitting}
            >
              {isResolvingPriority
                ? taskMessages.checkingPriority
                : taskMessages.addTask}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </div>
  );
}
