import {
  api,
  type AiSuggestionEnabledModules,
  type AiSuggestionsResponse,
} from "@/lib/supabase/api";
import { useAction, useQuery } from "@/lib/supabase/hooks";
import React, { useState } from "react";
import { Id } from "@/lib/supabase/types";
import { Loader } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import AiRecommendDialog, {
  AiRecommendReferenceDraft,
  AiRecommendTaskDraft,
} from "./ai-recommend-dialog";

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

  const requestSuggestions = async (
    autoCreate: boolean
  ): Promise<AiSuggestionsResponse> => {
    if (isSubTask) {
      if (!parentId) {
        throw new Error("Missing parent task id for sub-task suggestions.");
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
          title: "추천할 작업이 없습니다",
          description: "현재 정보 기준으로 추가 추천이 없어요.",
          duration: 3000,
        });
        return;
      }

      setIsDialogOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI 추천 작업을 불러오지 못했습니다.";

      toast({
        title: "AI 추천 실패",
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
          title: `⚡ ${response.created}개 작업을 빠르게 추가했어요`,
          duration: 3000,
        });
      } else {
        toast({
          title: "빠른 추가 결과가 없습니다",
          description: "생성할 추천 작업이 없어요.",
          duration: 3000,
        });
      }

      setIsDialogOpen(false);
      setRecommendations([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "빠른 추가 중 오류가 발생했습니다.";

      toast({
        title: "빠른 추가 실패",
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
        title: "생성할 항목이 없습니다",
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
        throw new Error(`${index + 1}번째 추천의 라벨 이름을 입력해 주세요.`);
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
        throw new Error(`새 라벨 생성에 실패했습니다: ${trimmedName}`);
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
        throw new Error(`${index + 1}번째 추천의 페르소나 이름을 입력해 주세요.`);
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
        throw new Error(`새 페르소나 생성에 실패했습니다: ${trimmedName}`);
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
        throw new Error(`${index + 1}번째 추천의 에픽 이름을 입력해 주세요.`);
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
        throw new Error(`새 에픽 생성에 실패했습니다: ${trimmedName}`);
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
        throw new Error(`${index + 1}번째 추천의 workload는 1 이상의 숫자여야 합니다.`);
      }

      return Math.max(1, Math.min(100, parsed));
    };

    try {
      let createdCount = 0;

      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];
        const taskNameValue = draft.taskName.trim();

        if (!taskNameValue) {
          throw new Error(`${index + 1}번째 추천의 taskName을 입력해 주세요.`);
        }

        const labelId = await resolveLabelId(draft.label, index);
        const personaId = await resolvePersonaId(draft.persona, index);
        const epicId = await resolveEpicId(draft.epic, index);
        const workload = resolveWorkload(draft.workload, index);

        const descriptionValue = draft.description.trim();
        const storyValue = draft.story.trim();

        if (isSubTask) {
          if (!parentId) {
            throw new Error("Missing parent task id for sub-task creation.");
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
        title: `✅ ${createdCount}개 추천 작업을 생성했어요`,
        duration: 3000,
      });

      setIsDialogOpen(false);
      setRecommendations([]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "선택 내용으로 작업 생성 중 오류가 발생했습니다.";

      toast({
        title: "선택 내용 생성 실패",
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
            Loading Tasks (AI)
            <Loader className="h-5 w-5 text-primary" />
          </div>
        ) : (
          "Suggest Missing Tasks (AI) 💖"
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
