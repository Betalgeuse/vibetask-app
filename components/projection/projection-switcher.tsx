"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { Doc } from "@/lib/supabase/types";
import { ProjectionKind } from "@/lib/types/task-projection";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ProjectionSwitcherProps {
  projectionKind: ProjectionKind;
  className?: string;
}

function resolveCompatibleProjections(
  projections: Array<Doc<"taskProjections">>,
  projectionKind: ProjectionKind
) {
  const exactMatches = projections.filter(
    (projection) => projection.projectionKind === projectionKind
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const customMatches = projections.filter(
    (projection) => projection.projectionKind === "custom"
  );

  if (customMatches.length > 0) {
    return customMatches;
  }

  return projections;
}

function isPersistableProjection(projection: Doc<"taskProjections">) {
  return !projection.isVirtual && !projection._id.startsWith("legacy:");
}

export default function ProjectionSwitcher({
  projectionKind,
  className,
}: ProjectionSwitcherProps) {
  const projectionsQuery = useQuery(api.projections.getProjections);
  const updateProjection = useMutation(api.projections.updateAProjection);

  const [selectedProjectionId, setSelectedProjectionId] = useState<string | null>(
    null
  );
  const [isPersisting, setIsPersisting] = useState(false);

  const compatibleProjections = useMemo(() => {
    if (!projectionsQuery) {
      return [] as Array<Doc<"taskProjections">>;
    }

    return resolveCompatibleProjections(projectionsQuery, projectionKind);
  }, [projectionKind, projectionsQuery]);

  const preferredProjection = useMemo(() => {
    if (compatibleProjections.length === 0) {
      return null;
    }

    return compatibleProjections.find((projection) => projection.isDefault) ?? compatibleProjections[0];
  }, [compatibleProjections]);

  const preferredProjectionId = preferredProjection?._id ?? null;

  useEffect(() => {
    if (compatibleProjections.length === 0) {
      setSelectedProjectionId(null);
      return;
    }

    setSelectedProjectionId((currentValue) => {
      if (
        currentValue &&
        compatibleProjections.some((projection) => projection._id === currentValue)
      ) {
        return currentValue;
      }

      return preferredProjectionId ?? compatibleProjections[0]._id;
    });
  }, [compatibleProjections, preferredProjectionId]);

  const selectedProjection =
    compatibleProjections.find((projection) => projection._id === selectedProjectionId) ??
    preferredProjection;

  const handleProjectionChange = async (projectionId: string) => {
    setSelectedProjectionId(projectionId);

    const nextProjection = compatibleProjections.find(
      (projection) => projection._id === projectionId
    );

    if (!nextProjection || !isPersistableProjection(nextProjection)) {
      return;
    }

    setIsPersisting(true);

    try {
      await updateProjection({
        projectionId: nextProjection._id,
        isDefault: true,
      });
    } catch (error) {
      console.error("Failed to persist preferred projection", error);
    } finally {
      setIsPersisting(false);
    }
  };

  const hasProjectionOptions = compatibleProjections.length > 0;
  const helperMessage = !projectionsQuery
    ? "Legacy fallback"
    : isPersisting
      ? "Saving..."
      : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-foreground/70">Projection</span>
      <Select
        value={selectedProjection?._id}
        onValueChange={(value) => {
          void handleProjectionChange(value);
        }}
        disabled={!hasProjectionOptions || isPersisting}
      >
        <SelectTrigger className="h-9 w-[220px]">
          <SelectValue placeholder="Default projection" />
        </SelectTrigger>
        <SelectContent>
          {compatibleProjections.map((projection) => (
            <SelectItem key={projection._id} value={projection._id}>
              {projection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperMessage ? (
        <span className="text-[11px] text-foreground/60">{helperMessage}</span>
      ) : null}
    </div>
  );
}
