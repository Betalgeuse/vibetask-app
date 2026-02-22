import {
  api,
  type AiSuggestionEnabledModules,
  type AiSuggestionsResponse,
} from "@/lib/supabase/api";
import { useAction, useQuery } from "@/lib/supabase/hooks";
import React, { useMemo, useState } from "react";
import { Id } from "@/lib/supabase/types";
import { Loader } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import AiRecommendDialog, {
  AiRecommendReferenceDraft,
  AiRecommendTaskDraft,
} from "./ai-recommend-dialog";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";

const DEFAULT_ENABLED_MODULES: AiSuggestionEnabledModules = {
  persona: false,
  epic: false,
  story: false,
  workload: false,
};

export default function SuggestMissingTasks({
  projectId,
  isSubTask = false,
  taskName = "",
  description = "",
  parentId,
}: {
  projectId: Id<"projects">;
  isSubTask?: boolean;
  taskName?: string;
  description?: string;
  parentId?: Id<"todos">;
}) {
  const { toast } = useToast();

  const [isLoadingSuggestMissingTasks, setIsLoadingSuggestMissingTasks] =
    useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [isCreatingFromSelection, setIsCreatingFromSelection] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [enabledModules, setEnabledModules] =
    useState<AiSuggestionEnabledModules>(DEFAULT_ENABLED_MODULES);
  const [recommendations, setRecommendations] =
    useState<AiSuggestionsResponse["recommendations"]>([]);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const suggestionMessages = messages.suggestions;

  const labels = useQuery(api.labels.getLabels) ?? [];
  const personas = useQuery(api.personas.getPersonas) ?? [];
  const epics = useQuery(api.epics.getEpics) ?? [];

  const suggestMissingTasks = useAction(api.openai.suggestMissingItemsWithAi);
  const suggestMissingSubTasks = useAction(api.openai.suggestMissingSubItemsWithAi);

  const createTodoEmbeddings = useAction(api.todos.createTodoAndEmbeddings);
  const createSubTodoEmbeddings = useAction(api.subTodos.createSubTodoAndEmbeddings);

  const createALabel = useAction(api.labels.createALabel);
  const createAPersona = useAction(api.personas.createAPersona);
  const createAnEpic = useAction(api.epics.createAnEpic);

  const normalizeNameKey = (value: string) => value.trim().toLowerCase();
  const formatSuggestionTemplate = (
    template: string,
    values: Record<string, string | number>
  ) => {
    return Object.entries(values).reduce((acc, [key, value]) => {
      return acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }, template);
  };

  const requestSuggestions = async (
    autoCreate: boolean
  ): Promise<AiSuggestionsResponse> => {
    if (isSubTask) {
      if (!parentId) {
        throw new Error(suggestionMessages.missingParentForSubTask);
      }

      return suggestMissingSubTasks({
        projectId,
        parentId,
        taskName,
        description,
        autoCreate,
      });
    }

    return suggestMissingTasks({ projectId, autoCreate });
  };

  const handleMissingTasks = async () => {
    setIsLoadingSuggestMissingTasks(true);

    try {
      const response = await requestSuggestions(false);
      setEnabledModules(response.enabledModules);
      setRecommendations(response.recommendations);

      if (response.recommendations.length === 0) {
        toast({
          title: suggestionMessages.noRecommendationsTitle,
          description: suggestionMessages.noRecommendationsDescription,
          duration: 3000,
        });
        return;
      }

      setIsDialogOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : suggestionMessages.requestFailureDescription;

      toast({
        title: suggestionMessages.requestFailureTitle,
        description: message,
        duration: 3500,
      });
    } finally {
      setIsLoadingSuggestMissingTasks(false);
    }
  };

  const handleQuickAdd = async () => {
    setIsQuickAdding(true);

    try {
      const response = await requestSuggestions(true);

      if (response.created > 0) {
        toast({
          title: formatSuggestionTemplate(
            suggestionMessages.quickAddSuccessTitle,
            { count: response.created }
          ),
          duration: 3000,
        });
      } else {
        toast({
          title: suggestionMessages.quickAddEmptyTitle,
          description: suggestionMessages.quickAddEmptyDescription,
          duration: 3000,
        });
      }

      setIsDialogOpen(false);
      setRecommendations([]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : suggestionMessages.quickAddFailureDescription;

      toast({
        title: suggestionMessages.quickAddFailureTitle,
        description: message,
        duration: 3500,
      });
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleCreateFromSelection = async (drafts: AiRecommendTaskDraft[]) => {
    if (drafts.length === 0) {
      toast({
        title: suggestionMessages.noItemsToCreateTitle,
        duration: 3000,
      });
      return;
    }

    setIsCreatingFromSelection(true);

    const createdLabelIds = new Map<string, Id<"labels">>();
    const createdPersonaIds = new Map<string, Id<"personas">>();
    const createdEpicIds = new Map<string, Id<"epics">>();

    const resolveLabelId = async (
      reference: AiRecommendReferenceDraft,
      index: number
    ): Promise<Id<"labels">> => {
      if (reference.type === "existing") {
        return reference.id as Id<"labels">;
      }

      const trimmedName = reference.name.trim();
      if (!trimmedName) {
        throw new Error(
          formatSuggestionTemplate(suggestionMessages.labelNameRequiredTemplate, {
            index: index + 1,
          })
        );
      }

      const key = normalizeNameKey(trimmedName);
      const existingLabel = labels.find(
        (label) => normalizeNameKey(label.name) === key
      );

      if (existingLabel) {
        return existingLabel._id;
      }

      const cachedLabelId = createdLabelIds.get(key);
      if (cachedLabelId) {
        return cachedLabelId;
      }

      const createdLabelId = await createALabel({ name: trimmedName });
      if (!createdLabelId) {
        throw new Error(
          formatSuggestionTemplate(suggestionMessages.labelCreateFailureTemplate, {
            name: trimmedName,
          })
        );
      }

      const typedLabelId = createdLabelId as Id<"labels">;
      createdLabelIds.set(key, typedLabelId);
      return typedLabelId;
    };

    const resolvePersonaId = async (
      reference: AiRecommendReferenceDraft | undefined,
      index: number
    ): Promise<Id<"personas"> | undefined> => {
      if (!enabledModules.persona || !reference) {
        return undefined;
      }

      if (reference.type === "existing") {
        return reference.id as Id<"personas">;
      }

      const trimmedName = reference.name.trim();
      if (!trimmedName) {
        throw new Error(
          formatSuggestionTemplate(
            suggestionMessages.personaNameRequiredTemplate,
            {
              index: index + 1,
            }
          )
        );
      }

      const key = normalizeNameKey(trimmedName);
      const existingPersona = personas.find(
        (persona) => normalizeNameKey(persona.name) === key
      );

      if (existingPersona) {
        return existingPersona._id;
      }

      const cachedPersonaId = createdPersonaIds.get(key);
      if (cachedPersonaId) {
        return cachedPersonaId;
      }

      const createdPersonaId = await createAPersona({ name: trimmedName });
      if (!createdPersonaId) {
        throw new Error(
          formatSuggestionTemplate(
            suggestionMessages.personaCreateFailureTemplate,
            {
              name: trimmedName,
            }
          )
        );
      }

      const typedPersonaId = createdPersonaId as Id<"personas">;
      createdPersonaIds.set(key, typedPersonaId);
      return typedPersonaId;
    };

    const resolveEpicId = async (
      reference: AiRecommendReferenceDraft | undefined,
      index: number
    ): Promise<Id<"epics"> | undefined> => {
      if (!enabledModules.epic || !reference) {
        return undefined;
      }

      if (reference.type === "existing") {
        return reference.id as Id<"epics">;
      }

      const trimmedName = reference.name.trim();
      if (!trimmedName) {
        throw new Error(
          formatSuggestionTemplate(suggestionMessages.epicNameRequiredTemplate, {
            index: index + 1,
          })
        );
      }

      const key = normalizeNameKey(trimmedName);
      const existingEpic = epics.find((epic) => normalizeNameKey(epic.name) === key);

      if (existingEpic) {
        return existingEpic._id;
      }

      const cachedEpicId = createdEpicIds.get(key);
      if (cachedEpicId) {
        return cachedEpicId;
      }

      const createdEpicId = await createAnEpic({ name: trimmedName });
      if (!createdEpicId) {
        throw new Error(
          formatSuggestionTemplate(suggestionMessages.epicCreateFailureTemplate, {
            name: trimmedName,
          })
        );
      }

      const typedEpicId = createdEpicId as Id<"epics">;
      createdEpicIds.set(key, typedEpicId);
      return typedEpicId;
    };

    const resolveWorkload = (value: string, index: number) => {
      if (!enabledModules.workload) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(
          formatSuggestionTemplate(suggestionMessages.workloadInvalidTemplate, {
            index: index + 1,
          })
        );
      }

      return Math.max(1, Math.min(100, parsed));
    };

    try {
      let createdCount = 0;

      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];
        const taskNameValue = draft.taskName.trim();

        if (!taskNameValue) {
          throw new Error(
            formatSuggestionTemplate(suggestionMessages.taskNameRequiredTemplate, {
              index: index + 1,
            })
          );
        }

        const labelId = await resolveLabelId(draft.label, index);
        const personaId = await resolvePersonaId(draft.persona, index);
        const epicId = await resolveEpicId(draft.epic, index);
        const workload = resolveWorkload(draft.workload, index);

        const descriptionValue = draft.description.trim();
        const storyValue = draft.story.trim();

        if (isSubTask) {
          if (!parentId) {
            throw new Error(suggestionMessages.missingParentForSubTaskCreation);
          }

          await createSubTodoEmbeddings({
            parentId,
            taskName: taskNameValue,
            description: descriptionValue || undefined,
            story: enabledModules.story ? storyValue || undefined : undefined,
            priority: 1,
            workload,
            epicId,
            personaId,
            dueDate: Date.now(),
            projectId,
            labelId,
          });
        } else {
          await createTodoEmbeddings({
            taskName: taskNameValue,
            description: descriptionValue || undefined,
            story: enabledModules.story ? storyValue || undefined : undefined,
            priority: 1,
            workload,
            epicId,
            personaId,
            dueDate: Date.now(),
            projectId,
            labelId,
          });
        }

        createdCount += 1;
      }

      toast({
        title: formatSuggestionTemplate(
          suggestionMessages.createSelectedSuccessTitle,
          { count: createdCount }
        ),
        duration: 3000,
      });

      setIsDialogOpen(false);
      setRecommendations([]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : suggestionMessages.createSelectedFailureDescription;

      toast({
        title: suggestionMessages.createSelectedFailureTitle,
        description: message,
        duration: 4000,
      });
    } finally {
      setIsCreatingFromSelection(false);
    }
  };

  return (
    <>
      <Button
        variant={"outline"}
        disabled={
          isLoadingSuggestMissingTasks || isQuickAdding || isCreatingFromSelection
        }
        onClick={handleMissingTasks}
      >
        {isLoadingSuggestMissingTasks ? (
          <div className="flex gap-2">
            {suggestionMessages.loadingButtonLabel}
            <Loader className="h-5 w-5 text-primary" />
          </div>
        ) : (
          suggestionMessages.buttonLabel
        )}
      </Button>

      <AiRecommendDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        recommendations={recommendations}
        enabledModules={enabledModules}
        labels={labels}
        personas={personas}
        epics={epics}
        isQuickAdding={isQuickAdding}
        isCreating={isCreatingFromSelection}
        onQuickAdd={handleQuickAdd}
        onCreateFromSelected={handleCreateFromSelection}
      />
    </>
  );
}
