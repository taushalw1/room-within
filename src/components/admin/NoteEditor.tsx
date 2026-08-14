"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { saveNote } from "@/app/(admin)/admin/counselling/actions";
import { cn } from "@/lib/cn";

export function NoteEditor({
  appointmentId,
  initialBody,
}: {
  appointmentId: string;
  initialBody: string;
}) {
  const [result, action, pending] = useActionState(saveNote, null);

  return (
    <form action={action} className="px-5 py-5">
      <input type="hidden" name="appointmentId" value={appointmentId} />

      <label htmlFor="note-body" className="sr-only">
        Session note
      </label>
      <textarea
        id="note-body"
        name="body"
        defaultValue={initialBody}
        rows={16}
        placeholder="Write your note here…"
        className="w-full resize-y rounded-[var(--radius-card)] border border-tan/40 bg-parchment/40 p-4 font-body text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-faint"
      />

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save note
        </Button>

        {result && (
          <p
            role="status"
            className={cn(
              "text-sm",
              result.ok ? "text-olive" : "text-burgundy",
            )}
          >
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
