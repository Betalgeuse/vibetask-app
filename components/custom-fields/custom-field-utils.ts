import { CustomFieldDefinitionDoc, CustomFieldValueDoc, Id } from "@/lib/supabase/types";

export type CustomFieldDraftValue = string | boolean | undefined;

export type CustomFieldDraftValues = Record<string, CustomFieldDraftValue>;

export type CustomFieldUpsertInput = {
  fieldId: Id<"customFieldDefinitions">;
  value: unknown;
};

export type CustomFieldSelectOption = {
  label: string;
  value: string;
};

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const [yearText, monthText, dayText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate.getTime();
}

function stringifyUnknownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return "";
  }
}

export function getCustomFieldSelectOptions(
  definition: CustomFieldDefinitionDoc
): CustomFieldSelectOption[] {
  const seenValues = new Set<string>();
  const normalizedOptions: CustomFieldSelectOption[] = [];

  for (const option of definition.options) {
    let value: string | null = null;
    let label: string | null = null;

    if (typeof option === "string") {
      const normalized = option.trim();
      if (normalized) {
        value = normalized;
        label = normalized;
      }
    } else if (typeof option === "number" || typeof option === "boolean") {
      value = String(option);
      label = value;
    } else if (option && typeof option === "object") {
      const optionRecord = option as Record<string, unknown>;
      const valueCandidate =
        optionRecord.value ??
        optionRecord.id ??
        optionRecord.key ??
        optionRecord.label ??
        optionRecord.name;
      const labelCandidate =
        optionRecord.label ?? optionRecord.name ?? optionRecord.value;

      value =
        toTrimmedString(valueCandidate) ??
        (typeof valueCandidate === "number" || typeof valueCandidate === "boolean"
          ? String(valueCandidate)
          : null);
      label =
        toTrimmedString(labelCandidate) ??
        (typeof labelCandidate === "number" || typeof labelCandidate === "boolean"
          ? String(labelCandidate)
          : null);
    }

    if (!value) {
      continue;
    }

    if (seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    normalizedOptions.push({
      value,
      label: label ?? value,
    });
  }

  return normalizedOptions;
}

export function getCustomFieldDraftValue(
  definition: CustomFieldDefinitionDoc,
  valueDoc?: CustomFieldValueDoc
): CustomFieldDraftValue {
  if (definition.fieldType === "boolean") {
    return typeof valueDoc?.valueBoolean === "boolean"
      ? valueDoc.valueBoolean
      : undefined;
  }

  if (definition.fieldType === "number") {
    return typeof valueDoc?.valueNumber === "number"
      ? String(valueDoc.valueNumber)
      : "";
  }

  if (definition.fieldType === "date") {
    return typeof valueDoc?.valueDate === "number"
      ? toDateInputValue(valueDoc.valueDate)
      : "";
  }

  if (definition.fieldType === "text" || definition.fieldType === "single_select") {
    return valueDoc?.valueText ?? "";
  }

  if (typeof valueDoc?.valueText === "string") {
    return valueDoc.valueText;
  }

  return stringifyUnknownValue(valueDoc?.valueJson);
}

export function buildCustomFieldDraftValues({
  definitions,
  values,
}: {
  definitions: CustomFieldDefinitionDoc[];
  values: CustomFieldValueDoc[];
}): CustomFieldDraftValues {
  const valueByFieldId = new Map(values.map((value) => [value.fieldId, value]));

  return definitions.reduce<CustomFieldDraftValues>((acc, definition) => {
    acc[definition._id] = getCustomFieldDraftValue(
      definition,
      valueByFieldId.get(definition._id)
    );
    return acc;
  }, {});
}

export function normalizeCustomFieldDraftValue({
  definition,
  draftValue,
}: {
  definition: CustomFieldDefinitionDoc;
  draftValue: CustomFieldDraftValue;
}): unknown {
  if (definition.fieldType === "boolean") {
    return typeof draftValue === "boolean" ? draftValue : null;
  }

  if (definition.fieldType === "number") {
    if (typeof draftValue !== "string") {
      return null;
    }

    const trimmed = draftValue.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (definition.fieldType === "date") {
    if (typeof draftValue !== "string") {
      return null;
    }

    return parseDateInput(draftValue);
  }

  if (definition.fieldType === "text" || definition.fieldType === "single_select") {
    return toTrimmedString(draftValue);
  }

  if (typeof draftValue === "string") {
    return toTrimmedString(draftValue);
  }

  return typeof draftValue === "boolean" ? draftValue : null;
}

export function buildCustomFieldUpsertInputs({
  definitions,
  drafts,
  includeEmpty = false,
}: {
  definitions: CustomFieldDefinitionDoc[];
  drafts: CustomFieldDraftValues;
  includeEmpty?: boolean;
}): CustomFieldUpsertInput[] {
  const upserts: CustomFieldUpsertInput[] = [];

  for (const definition of definitions) {
    const normalizedValue = normalizeCustomFieldDraftValue({
      definition,
      draftValue: drafts[definition._id],
    });

    if (!includeEmpty && normalizedValue === null) {
      continue;
    }

    upserts.push({
      fieldId: definition._id,
      value: normalizedValue,
    });
  }

  return upserts;
}

export function formatCustomFieldDraftValueForDisplay({
  definition,
  draftValue,
}: {
  definition: CustomFieldDefinitionDoc;
  draftValue: CustomFieldDraftValue;
}): string {
  if (definition.fieldType === "boolean") {
    if (draftValue === true) return "Yes";
    if (draftValue === false) return "No";
    return "";
  }

  if (definition.fieldType === "date") {
    if (typeof draftValue !== "string") {
      return "";
    }

    const timestamp = parseDateInput(draftValue);
    if (timestamp === null) {
      return "";
    }

    return new Date(timestamp).toLocaleDateString();
  }

  if (definition.fieldType === "single_select") {
    const selectedValue = toTrimmedString(draftValue);
    if (!selectedValue) {
      return "";
    }

    const option = getCustomFieldSelectOptions(definition).find(
      (item) => item.value === selectedValue
    );
    return option?.label ?? selectedValue;
  }

  if (typeof draftValue !== "string") {
    return "";
  }

  return draftValue.trim();
}
