"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomFieldDefinitionDoc } from "@/lib/supabase/types";
import {
  CustomFieldDraftValue,
  getCustomFieldSelectOptions,
} from "./custom-field-utils";

const EMPTY_SELECT_VALUE = "__custom_field_empty__";

export function CustomFieldInput({
  definition,
  value,
  onChange,
  disabled = false,
  placeholder,
}: {
  definition: CustomFieldDefinitionDoc;
  value: CustomFieldDraftValue;
  onChange: (value: CustomFieldDraftValue) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  if (definition.fieldType === "boolean") {
    return (
      <Checkbox
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked === true)}
        disabled={disabled}
        aria-label={definition.displayName}
      />
    );
  }

  if (definition.fieldType === "single_select") {
    const options = getCustomFieldSelectOptions(definition);

    if (options.length > 0) {
      const normalizedValue =
        typeof value === "string" && value.trim() ? value : EMPTY_SELECT_VALUE;
      const hasMatchingOption = options.some(
        (option) => option.value === normalizedValue
      );
      const resolvedValue = hasMatchingOption
        ? normalizedValue
        : EMPTY_SELECT_VALUE;

      return (
        <Select
          onValueChange={(nextValue) =>
            onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)
          }
          value={resolvedValue}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder ?? "Select option"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SELECT_VALUE}>None</SelectItem>
            {options.map((option) => (
              <SelectItem
                key={`${definition._id}-${option.value}`}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
  }

  if (definition.fieldType === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Enter a number"}
        disabled={disabled}
      />
    );
  }

  if (definition.fieldType === "date") {
    return (
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Select a date"}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder ?? "Enter a value"}
      disabled={disabled}
    />
  );
}
