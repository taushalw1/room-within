"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  submitCounsellingRequest,
  type RequestResult,
} from "@/app/(site)/counselling/request/actions";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 text-[0.95rem] placeholder:text-ink-faint";
const labelText = "eyebrow !text-[0.6rem] text-bark";

export function CounsellingRequestForm() {
  const [result, action, pending] = useActionState<RequestResult | null, FormData>(
    submitCounsellingRequest,
    null,
  );

  if (result?.status === "sent") {
    return (
      <div className="rounded-[var(--radius-card)] border border-olive/30 bg-sage-pale/40 p-8 text-center">
        <h2 className="text-2xl">Your message has arrived</h2>
        <p className="mt-3 text-ink-soft">{result.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>Your name</span>
          <input name="fullName" required className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className={labelText}>Email</span>
          <input name="email" type="email" required className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className={labelText}>Phone (optional)</span>
          <input name="phone" type="tel" className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className={labelText}>When suits you best</span>
          <input
            name="preferredTimes"
            placeholder="Weekday mornings, evenings…"
            className={cn(field, "mt-1.5")}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelText}>
          Anything you&rsquo;d like to say (entirely optional)
        </span>
        <textarea
          name="message"
          rows={5}
          placeholder="You don't need to explain yourself here — a sentence is plenty, and so is nothing at all."
          className={cn(field, "mt-1.5 resize-y")}
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
        />
        <span>
          I&rsquo;m happy for Tausha to contact me using the details above.
        </span>
      </label>

      {result?.status === "error" && (
        <p role="alert" className="text-sm text-burgundy">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Send to Tausha
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        This form is not monitored around the clock and is not for emergencies.
        If you need to speak to someone now, call the Alberta Mental Health Help
        Line on <strong>1-877-303-2642</strong> (24 hours), or 911 in an
        emergency.
      </p>
    </form>
  );
}
