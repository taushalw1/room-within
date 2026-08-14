"use client";

import { useActionState, useState } from "react";
import { CalendarX, Loader2, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Result = { ok: boolean; message: string };
type Action = (prev: Result | null, formData: FormData) => Promise<Result>;

/**
 * A destructive action, confirmed in two clicks.
 *
 * Deliberately not `window.confirm` — a browser dialog can't say what's about
 * to happen in the app's own words, reads as a system error, and on some
 * setups is suppressed entirely. This asks in place, and names the thing it's
 * asking about.
 */
export function ConfirmAction({
  id,
  action,
  question,
  label = "Delete",
  confirmLabel = "Yes, delete",
  icon: Icon = Trash2,
  tone = "danger",
  className,
}: {
  id: string;
  action: Action;
  /** Names the item, e.g. `"Thursday Morning Drop-In"` or "this $243.50 cost". */
  question: string;
  label?: string;
  confirmLabel?: string;
  icon?: LucideIcon;
  tone?: "danger" | "caution";
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [result, formAction, pending] = useActionState(action, null);

  // A successful action re-renders the list without this row, so the only
  // message worth keeping on screen is a failure.
  const problem = result && !result.ok ? result.message : null;

  if (!asking) {
    return (
      <div className={cn("flex flex-col items-end gap-1", className)}>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setAsking(true)}
          className={
            tone === "danger" ? "text-burgundy hover:bg-blush/60" : undefined
          }
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </Button>
        {problem && (
          <p role="alert" className="max-w-xs text-right text-xs text-burgundy">
            {problem}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <p className="max-w-xs text-right text-xs text-burgundy">{question}</p>
      <div className="flex gap-1.5">
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <Button
            size="sm"
            variant={tone === "danger" ? "danger" : "primary"}
            type="submit"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-3.5 w-3.5" aria-hidden />
            )}
            {confirmLabel}
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

      {problem && (
        <p role="alert" className="max-w-xs text-right text-xs text-burgundy">
          {problem}
        </p>
      )}
    </div>
  );
}

/** Ending a tenancy — the usual alternative to deleting a lease. */
export function EndTenancyButton({
  id,
  action,
  question,
}: {
  id: string;
  action: Action;
  question: string;
}) {
  return (
    <ConfirmAction
      id={id}
      action={action}
      question={question}
      label="End tenancy"
      confirmLabel="Yes, end it"
      icon={CalendarX}
      tone="caution"
    />
  );
}
