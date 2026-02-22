"use client";

import {
  AiSuggestedReference,
  AiSuggestedTodo,
  AiSuggestionEnabledModules,
} from "@/lib/supabase/api";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

type NamedOption = {
  _id: string;
  name: string;
};

export type AiRecommendReferenceDraft =
  | {
      type: "existing";
      id: string;
      name: string;
    }
  | {
      type: "new";
      name: string;
    };

export type AiRecommendTaskDraft = {
  id: string;
  taskName: string;
  description: string;
  label: AiRecommendReferenceDraft;
  persona?: AiRecommendReferenceDraft;
  epic?: AiRecommendReferenceDraft;
  story: string;
  workload: string;
};

type AiRecommendDialogProps = {
  open: boolean;
  recommendations: AiSuggestedTodo[];
  enabledModules: AiSuggestionEnabledModules;
  labels: NamedOption[];
  personas: NamedOption[];
  epics: NamedOption[];
  isQuickAdding?: boolean;
  isCreating?: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickAdd: () => Promise<void> | void;
  onCreateFromSelected: (drafts: AiRecommendTaskDraft[]) => Promise<void> | void;
};

const NEW_REFERENCE_VALUE = "__new__";
const NONE_REFERENCE_VALUE = "__none__";

function toDraftReference(
  reference: AiSuggestedReference | undefined,
  fallbackOption?: NamedOption
): AiRecommendReferenceDraft {
  if (reference?.type === "existing") {
    return {
      type: "existing",
      id: reference.id,
      name: reference.name,
    };
  }

  if (reference?.type === "new") {
    return {
      type: "new",
      name: reference.name,
    };
  }

  if (fallbackOption) {
    return {
      type: "existing",
      id: fallbackOption._id,
      name: fallbackOption.name,
    };
  }

  return {
    type: "new",
    name: "",
  };
}

function toSelectValue(reference: AiRecommendReferenceDraft | undefined) {
  if (!reference || reference.type === "new") {
    return NEW_REFERENCE_VALUE;
  }

  return `existing:${reference.id}`;
}

function fromSelectValue(
  value: string,
  options: NamedOption[],
  fallbackNewName = ""
): AiRecommendReferenceDraft {
  if (value === NEW_REFERENCE_VALUE) {
    return {
      type: "new",
      name: fallbackNewName,
    };
  }

  const selectedId = value.replace("existing:", "");
  const selectedOption = options.find((option) => option._id === selectedId);

  if (!selectedOption) {
    return {
      type: "new",
      name: fallbackNewName,
    };
  }

  return {
    type: "existing",
    id: selectedOption._id,
    name: selectedOption.name,
  };
}

export default function AiRecommendDialog({
  open,
  recommendations,
  enabledModules,
  labels,
  personas,
  epics,
  isQuickAdding = false,
  isCreating = false,
  onOpenChange,
  onQuickAdd,
  onCreateFromSelected,
}: AiRecommendDialogProps) {
  const [drafts, setDrafts] = useState<AiRecommendTaskDraft[]>([]);

  useEffect(() => {
    const fallbackLabel = labels[0];

    setDrafts(
      recommendations.map((item, index) => ({
        id: `recommendation-${index}`,
        taskName: item.taskName,
        description: item.description ?? "",
        label: toDraftReference(item.suggestedLabel, fallbackLabel),
        persona:
          enabledModules.persona && item.suggestedPersona
            ? toDraftReference(item.suggestedPersona)
            : undefined,
        epic:
          enabledModules.epic && item.suggestedEpic
            ? toDraftReference(item.suggestedEpic)
            : undefined,
        story: enabledModules.story ? item.suggestedStory ?? "" : "",
        workload:
          enabledModules.workload && typeof item.suggestedWorkload === "number"
            ? item.suggestedWorkload.toString()
            : "",
      }))
    );
  }, [
    enabledModules.epic,
    enabledModules.persona,
    enabledModules.story,
    enabledModules.workload,
    labels,
    recommendations,
  ]);

  const updateDraft = (
    draftId: string,
    updater: (draft: AiRecommendTaskDraft) => AiRecommendTaskDraft
  ) => {
    setDrafts((prev) =>
      prev.map((draft) => (draft.id === draftId ? updater(draft) : draft))
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isQuickAdding || isCreating) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI 추천 작업 확인</DialogTitle>
          <DialogDescription>
            추천 내용을 수정한 뒤 생성하거나, 빠른 추가로 바로 생성할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-1">
          {drafts.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-foreground/70">
              추천 결과가 없습니다.
            </div>
          ) : (
            drafts.map((draft, index) => (
              <div key={draft.id} className="space-y-4 rounded-md border p-4">
                <p className="text-sm font-semibold">추천 {index + 1}</p>

                <div className="space-y-2">
                  <Label htmlFor={`${draft.id}-taskName`}>Task name</Label>
                  <Input
                    id={`${draft.id}-taskName`}
                    value={draft.taskName}
                    onChange={(event) =>
                      updateDraft(draft.id, (prev) => ({
                        ...prev,
                        taskName: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${draft.id}-description`}>Description</Label>
                  <Textarea
                    id={`${draft.id}-description`}
                    value={draft.description}
                    onChange={(event) =>
                      updateDraft(draft.id, (prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Label</Label>
                  <Select
                    value={toSelectValue(draft.label)}
                    onValueChange={(value) =>
                      updateDraft(draft.id, (prev) => ({
                        ...prev,
                        label: fromSelectValue(
                          value,
                          labels,
                          prev.label.type === "new" ? prev.label.name : ""
                        ),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="라벨 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {labels.map((label) => (
                        <SelectItem
                          key={`label-${label._id}`}
                          value={`existing:${label._id}`}
                        >
                          {label.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_REFERENCE_VALUE}>+ 새 라벨</SelectItem>
                    </SelectContent>
                  </Select>

                  {draft.label.type === "new" && (
                    <Input
                      value={draft.label.name}
                      placeholder="새 라벨 이름"
                      onChange={(event) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          label: {
                            type: "new",
                            name: event.target.value,
                          },
                        }))
                      }
                    />
                  )}
                </div>

                {enabledModules.persona && (
                  <div className="space-y-2">
                    <Label>Persona</Label>
                    <Select
                      value={
                        draft.persona
                          ? toSelectValue(draft.persona)
                          : NONE_REFERENCE_VALUE
                      }
                      onValueChange={(value) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          persona:
                            value === NONE_REFERENCE_VALUE
                              ? undefined
                              : fromSelectValue(
                                  value,
                                  personas,
                                  prev.persona?.type === "new"
                                    ? prev.persona.name
                                    : ""
                                ),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="페르소나 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_REFERENCE_VALUE}>
                          선택 안 함
                        </SelectItem>
                        {personas.map((persona) => (
                          <SelectItem
                            key={`persona-${persona._id}`}
                            value={`existing:${persona._id}`}
                          >
                            {persona.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={NEW_REFERENCE_VALUE}>
                          + 새 페르소나
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {draft.persona?.type === "new" && (
                      <Input
                        value={draft.persona.name}
                        placeholder="새 페르소나 이름"
                        onChange={(event) =>
                          updateDraft(draft.id, (prev) => ({
                            ...prev,
                            persona: {
                              type: "new",
                              name: event.target.value,
                            },
                          }))
                        }
                      />
                    )}
                  </div>
                )}

                {enabledModules.epic && (
                  <div className="space-y-2">
                    <Label>Epic</Label>
                    <Select
                      value={
                        draft.epic ? toSelectValue(draft.epic) : NONE_REFERENCE_VALUE
                      }
                      onValueChange={(value) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          epic:
                            value === NONE_REFERENCE_VALUE
                              ? undefined
                              : fromSelectValue(
                                  value,
                                  epics,
                                  prev.epic?.type === "new" ? prev.epic.name : ""
                                ),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="에픽 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_REFERENCE_VALUE}>
                          선택 안 함
                        </SelectItem>
                        {epics.map((epic) => (
                          <SelectItem
                            key={`epic-${epic._id}`}
                            value={`existing:${epic._id}`}
                          >
                            {epic.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={NEW_REFERENCE_VALUE}>+ 새 에픽</SelectItem>
                      </SelectContent>
                    </Select>

                    {draft.epic?.type === "new" && (
                      <Input
                        value={draft.epic.name}
                        placeholder="새 에픽 이름"
                        onChange={(event) =>
                          updateDraft(draft.id, (prev) => ({
                            ...prev,
                            epic: {
                              type: "new",
                              name: event.target.value,
                            },
                          }))
                        }
                      />
                    )}
                  </div>
                )}

                {enabledModules.story && (
                  <div className="space-y-2">
                    <Label htmlFor={`${draft.id}-story`}>Story</Label>
                    <Textarea
                      id={`${draft.id}-story`}
                      value={draft.story}
                      onChange={(event) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          story: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}

                {enabledModules.workload && (
                  <div className="space-y-2">
                    <Label htmlFor={`${draft.id}-workload`}>Workload (1-100)</Label>
                    <Input
                      id={`${draft.id}-workload`}
                      type="number"
                      min={1}
                      max={100}
                      value={draft.workload}
                      onChange={(event) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          workload: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={isQuickAdding || isCreating}
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={drafts.length === 0 || isQuickAdding || isCreating}
            onClick={() => void onQuickAdd()}
          >
            {isQuickAdding ? "빠른 추가 중..." : "빠른 추가"}
          </Button>
          <Button
            type="button"
            disabled={drafts.length === 0 || isQuickAdding || isCreating}
            onClick={() => void onCreateFromSelected(drafts)}
          >
            {isCreating ? "생성 중..." : "선택 내용으로 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
