"use client";

import { useActionState, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Result = { ok: boolean; message: string };
type DeleteAction = (
  prev: Result | null,
  formData: FormData,
) => Promise<Result>;

/**
 * Delete, in two clicks.
 *
 * Deliberately not `window.confirm` — a browser dialog can't say what's about
 * to be lost in the app's own words, reads as a system error, and on some
 * setups is suppressed entirely. This asks in place, and says what it's asking
 * about.
 */
export function ConfirmDelete({
  id,
  action,
  what,
  className,
}: {
  id: string;
  action: DeleteAction;
  /** Named in the confirmation, e.g. "this event". */
  what: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [result, formAction, pending] = useActionState(action, null);

  if (!asking) {
    return (
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => setAsking(true)}
        className={cn("text-burgundy hover:bg-blush/60", className)}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <p className="text-xs text-burgundy">
        Delete {what}? This can&rsquo;t be undone.
      </p>
      <div className="flex gap-1.5">
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <Button size="sm" variant="danger" type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Yes, delete
          </Button>
        </form>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={() => setAsking(false)}
          disabled={pending}
        >
          Keep
        </Button>
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-xs text-burgundy">
          {result.message}
        </p>
      )}
    </div>
  );
}
