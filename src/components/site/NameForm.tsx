"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { saveName, type ActionResult } from "@/app/(site)/welcome/actions";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 text-[0.95rem] placeholder:text-ink-faint";

export function NameForm({ next }: { next: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    saveName,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">Your name</span>
        <input
          name="fullName"
          required
          autoFocus
          autoComplete="name"
          placeholder="Sarah Whitecalf"
          className={cn(field, "mt-1.5")}
        />
      </label>

      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">
          Phone <span className="normal-case tracking-normal">(optional)</span>
        </span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="403-555-0123"
          className={cn(field, "mt-1.5")}
        />
        <span className="mt-1 block text-xs text-ink-faint">
          Only used if we need to reach you about a booking.
        </span>
      </label>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-burgundy">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Continue
      </Button>
    </form>
  );
}
