import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Doc } from "@/lib/supabase/types";
import Task from "./task";
import { cn } from "@/lib/utils";

export default function DraggableTask({
  data,
  label,
  isCompleted,
  handleOnChange,
  canExportToCalendar = false,
}: {
  data: Doc<"todos">;
  label?: Doc<"labels"> | null;
  isCompleted: boolean;
  handleOnChange: (checked: CheckedState) => void;
  canExportToCalendar?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: data._id,
    data: {
      taskId: data._id,
      status: data.status,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <Task
        data={data}
        label={label}
        isCompleted={isCompleted}
        handleOnChange={handleOnChange}
        canExportToCalendar={canExportToCalendar}
      />
    </div>
  );
}
