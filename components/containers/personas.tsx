"use client";

import { FormEvent, useState } from "react";

import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

export default function Personas() {
  const personas = useQuery(api.personas.getPersonas) ?? [];
  const createPersona = useMutation(api.personas.createAPersona);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createPersona({
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold md:text-2xl">Personas</h1>
      </div>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        Create your own persona options. Nothing is pre-seeded.
      </p>

      <form
        onSubmit={onSubmit}
        className="rounded-lg border bg-card p-4 mb-4 space-y-3 max-w-2xl"
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Persona name (e.g. Bio Entrepreneur)"
        />
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional description"
          className="min-h-20"
        />
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? "Saving..." : "Add persona"}
        </Button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {personas.map((persona) => (
          <div key={persona._id} className="rounded-lg border bg-card p-4">
            <p className="font-medium">{persona.name}</p>
            <p className="text-xs text-foreground/60 mt-1">{persona.code}</p>
            {persona.description && (
              <p className="text-sm text-foreground/75 mt-2">{persona.description}</p>
            )}
          </div>
        ))}
        {personas.length === 0 && (
          <p className="text-sm text-foreground/70">No personas yet.</p>
        )}
      </div>
    </div>
  );
}
