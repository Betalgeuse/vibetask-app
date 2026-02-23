import { CustomFieldInput } from "@/components/custom-fields/custom-field-input";
import {
  buildCustomFieldDraftValues,
  buildCustomFieldUpsertInputs,
  formatCustomFieldDraftValueForDisplay,
  type CustomFieldDraftValue,
  type CustomFieldDraftValues,
} from "@/components/custom-fields/custom-field-utils";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { api } from "@/lib/supabase/api";
import { useAction, useQuery } from "@/lib/supabase/hooks";
import { Doc } from "@/lib/supabase/types";
import { type TaskEntityRef } from "@/lib/types/task-projection";
import clsx from "clsx";
import { Calendar, GitBranch, Tag } from "lucide-react";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import AddTaskDialog from "../add-tasks/add-task-dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { useToast } from "../ui/use-toast";

type CalendarCreateEventResponse = {
  connected?: boolean;
  event?: {
    id: string;
    htmlLink: string | null;
  };
  error?: string;
};

function isSubTodo(
  data: Doc<"todos"> | Doc<"subTodos">
): data is Doc<"subTodos"> {
  return "parentId" in data;
}

export default function Task({
  data,
  label,
  isCompleted,
  handleOnChange,
  showDetails = false,
  canExportToCalendar = false,
}: {
  data: Doc<"todos"> | Doc<"subTodos">;
  label?: Doc<"labels"> | null;
  isCompleted: boolean;
  handleOnChange: any;
  showDetails?: boolean;
  canExportToCalendar?: boolean;
}) {
  const { toast } = useToast();
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const taskMessages = messages.tasks;
  const isSubTask = isSubTodo(data);
  const { taskName, description, dueDate } = data;
  const taskRef: TaskEntityRef = useMemo(
    () => ({
      taskKind: isSubTask ? "sub_todo" : "todo",
      taskId: data._id,
    }),
    [data._id, isSubTask]
  );

  const customFieldDefinitionsQuery = useQuery(
    api.customFields.getCustomFieldDefinitions,
    {
      appliesTo: taskRef.taskKind,
    }
  );
  const customFieldDefinitions = useMemo(
    () => customFieldDefinitionsQuery ?? [],
    [customFieldDefinitionsQuery]
  );
  const customFieldValuesQuery = useQuery(
    api.customFields.getCustomFieldValuesForTask,
    {
      taskRef,
    }
  );
  const customFieldValues = useMemo(
    () => customFieldValuesQuery ?? [],
    [customFieldValuesQuery]
  );
  const upsertCustomFieldValues = useAction(api.customFields.upsertCustomFieldValues);

  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false);
  const [isSavingCustomFields, setIsSavingCustomFields] = useState(false);
  const [isExportingToCalendar, setIsExportingToCalendar] = useState(false);
  const [customFieldDrafts, setCustomFieldDrafts] = useState<CustomFieldDraftValues>(
    {}
  );

  useEffect(() => {
    if (isEditingCustomFields) {
      return;
    }

    if (customFieldDefinitions.length === 0) {
      setCustomFieldDrafts((currentDrafts) =>
        Object.keys(currentDrafts).length === 0 ? currentDrafts : {}
      );
      return;
    }

    setCustomFieldDrafts(
      buildCustomFieldDraftValues({
        definitions: customFieldDefinitions,
        values: customFieldValues,
      })
    );
  }, [customFieldDefinitions, customFieldValues, isEditingCustomFields]);

  const customFieldSummary = useMemo(
    () =>
      customFieldDefinitions
        .map((definition) => {
          const displayValue = formatCustomFieldDraftValueForDisplay({
            definition,
            draftValue: customFieldDrafts[definition._id],
          });

          if (!displayValue) {
            return null;
          }

          return {
            fieldId: definition._id,
            name: definition.displayName,
            value: displayValue,
          };
        })
        .filter(
          (summary): summary is { fieldId: string; name: string; value: string } =>
            summary !== null
        ),
    [customFieldDefinitions, customFieldDrafts]
  );

  function onCustomFieldDraftChange(
    fieldId: string,
    nextValue: CustomFieldDraftValue
  ) {
    setCustomFieldDrafts((currentDrafts) => ({
      ...currentDrafts,
      [fieldId]: nextValue,
    }));
  }

  function onCancelCustomFieldEdit() {
    setCustomFieldDrafts(
      buildCustomFieldDraftValues({
        definitions: customFieldDefinitions,
        values: customFieldValues,
      })
    );
    setIsEditingCustomFields(false);
  }

  async function onSaveCustomFields() {
    if (isSavingCustomFields || customFieldDefinitions.length === 0) {
      return;
    }

    setIsSavingCustomFields(true);

    try {
      const values = buildCustomFieldUpsertInputs({
        definitions: customFieldDefinitions,
        drafts: customFieldDrafts,
        includeEmpty: true,
      });

      await upsertCustomFieldValues({
        taskRef,
        values,
      });
      setIsEditingCustomFields(false);
    } catch (error) {
      console.error("Failed to save custom field values.", error);
    } finally {
      setIsSavingCustomFields(false);
    }
  }

  async function onExportToCalendar() {
    if (isExportingToCalendar) {
      return;
    }

    setIsExportingToCalendar(true);

    try {
      const response = await fetch("/api/calendar/create-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskName,
          description: description || "",
          dueDate,
          durationMinutes: 60,
          timeZone:
            typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | CalendarCreateEventResponse
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.trim() || taskMessages.calendarExportFailureDescription
        );
      }

      toast({
        title: taskMessages.calendarExportSuccessTitle,
        description:
          payload?.event?.htmlLink?.trim()
            ? taskMessages.calendarExportSuccessDescriptionWithLink
            : taskMessages.calendarExportSuccessDescription,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: taskMessages.calendarExportFailureTitle,
        description:
          error instanceof Error
            ? error.message
            : taskMessages.calendarExportFailureDescription,
        duration: 3500,
      });
    } finally {
      setIsExportingToCalendar(false);
    }
  }

  return (
    <div
      key={data._id}
      className="flex items-center space-x-2 border-b-2 p-2 border-gray-100 animate-in fade-in"
    >
      <Dialog>
        <div className="flex gap-2 items-start justify-end w-full">
          <div className="flex gap-2 w-full">
            <Checkbox
              id="todo"
              className={clsx(
                "w-5 h-5 rounded-xl",
                isCompleted &&
                  "data-[state=checked]:bg-gray-300 border-gray-300"
              )}
              checked={isCompleted}
              onCheckedChange={handleOnChange}
            />
            <div className="flex w-full flex-col items-start">
              <DialogTrigger asChild>
                <div className="flex cursor-pointer flex-col items-start">
                  <button
                    className={clsx(
                      "text-sm font-normal text-left",
                      isCompleted && "line-through text-foreground/30"
                    )}
                  >
                    {taskName}
                  </button>
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
                  {showDetails && (
                    <div className="flex gap-2">
                      <div className="flex items-center justify-center gap-1">
                        <GitBranch className="w-3 h-3 text-foreground/70" />
                        <p className="text-xs text-foreground/70"></p>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        <p className="text-xs text-primary">
                          {moment(dueDate).format("LL")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </DialogTrigger>

              {customFieldDefinitions.length > 0 && (
                <div className="mt-1 w-full space-y-2">
                  {customFieldSummary.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {customFieldSummary.slice(0, 3).map((summary) => (
                        <span
                          key={summary.fieldId}
                          className="inline-flex items-center gap-1 rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] text-foreground/70"
                        >
                          <span>{summary.name}:</span>
                          <span className="font-medium">{summary.value}</span>
                        </span>
                      ))}
                      {customFieldSummary.length > 3 && (
                        <span className="inline-flex items-center rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] text-foreground/70">
                          {taskMessages.customFieldsMoreTemplate.replace(
                            "{count}",
                            String(customFieldSummary.length - 3)
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setIsEditingCustomFields((isOpen) => !isOpen)
                    }
                  >
                    {isEditingCustomFields
                      ? taskMessages.customFieldsHide
                      : customFieldSummary.length > 0
                        ? taskMessages.customFieldsEdit
                        : taskMessages.customFieldsAdd}
                  </Button>

                  {isEditingCustomFields && (
                    <div className="grid gap-2 rounded-md border border-foreground/20 p-2 md:grid-cols-2">
                      {customFieldDefinitions.map((definition) => (
                        <div key={definition._id} className="space-y-1">
                          <p className="text-xs font-medium text-foreground/80">
                            {definition.displayName}
                            {definition.isRequired ? " *" : ""}
                          </p>
                          {definition.fieldType === "boolean" ? (
                            <label className="flex items-center gap-2 rounded-md border px-2 py-2 text-xs">
                              <CustomFieldInput
                                definition={definition}
                                value={customFieldDrafts[definition._id]}
                                onChange={(nextValue) =>
                                  onCustomFieldDraftChange(
                                    definition._id,
                                    nextValue
                                  )
                                }
                                disabled={isSavingCustomFields}
                              />
                              <span className="text-foreground/70">
                                {customFieldDrafts[definition._id] === true
                                  ? taskMessages.checked
                                  : taskMessages.notChecked}
                              </span>
                            </label>
                          ) : (
                            <CustomFieldInput
                              definition={definition}
                              value={customFieldDrafts[definition._id]}
                              onChange={(nextValue) =>
                                onCustomFieldDraftChange(
                                  definition._id,
                                  nextValue
                                )
                              }
                              disabled={isSavingCustomFields}
                            />
                          )}
                        </div>
                      ))}
                      <div className="flex justify-end gap-2 pt-1 md:col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onCancelCustomFieldEdit}
                          disabled={isSavingCustomFields}
                        >
                          {taskMessages.cancel}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={onSaveCustomFields}
                          disabled={isSavingCustomFields}
                        >
                          {isSavingCustomFields
                            ? taskMessages.customFieldsSaving
                            : taskMessages.customFieldsSave}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canExportToCalendar && (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={isExportingToCalendar}
                    onClick={() => {
                      void onExportToCalendar();
                    }}
                  >
                    {isExportingToCalendar
                      ? taskMessages.calendarExportLoading
                      : taskMessages.calendarExportAction}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {!isSubTask && <AddTaskDialog data={data} />}
        </div>
      </Dialog>
    </div>
  );
}
