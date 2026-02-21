"use client";

import { FormEvent, useState } from "react";

import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

export default function Epics() {
  const epics = useQuery(api.epics.getEpics) ?? [];
  const createEpic = useMutation(api.epics.createAnEpic);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createEpic({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="xl:px-40">
      <h1 className="text-lg font-semibold md:text-2xl">Epics</h1>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Create your own epic groups and assign tasks when epic mode is enabled.
      </p>

      <form
        onSubmit={onSubmit}
        className="rounded-lg border bg-card p-4 mb-4 space-y-3 max-w-2xl"
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Epic name"
        />
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional description"
          className="min-h-20"
        />
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? "Saving..." : "Add epic"}
        </Button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {epics.map((epic) => (
          <div key={epic._id} className="rounded-lg border bg-card p-4">
            <p className="font-medium">{epic.name}</p>
            {epic.description && (
              <p className="text-sm text-foreground/75 mt-2">{epic.description}</p>
            )}
          </div>
        ))}
        {epics.length === 0 && (
          <p className="text-sm text-foreground/70">No epics yet.</p>
        )}
      </div>
    </div>
  );
}
