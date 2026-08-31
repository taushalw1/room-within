"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { signUpForClass } from "@/app/(site)/classes/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { dateTimeRange, moneyExact } from "@/lib/format";
import type { ClassSessionRow, PublicClass } from "@/lib/data/types";

const field =
  "w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 text-[0.95rem] placeholder:text-ink-faint";

/**
 * Signing up for a class.
 *
 * Nobody is asked for a card. The price is chosen by the person coming, and a
 * class that doesn't fill doesn't run — charging up front would only mean
 * refunding people later.
 */
export function ClassSignUp({
  klass,
  sessions,
  hasCredits,
  creditBalance,
}: {
  klass: PublicClass;
  sessions: ClassSessionRow[];
  hasCredits: boolean;
  creditBalance: number;
}) {
  const [result, action, pending] = useActionState(signUpForClass, null);
  const [tier, setTier] = useState<"full" | "reduced" | "subsidized">("full");

  if (result?.ok) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-sage-pale/60 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-olive" aria-hidden />
        <p className="text-sm text-ink">{result.message}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] bg-parchment/70 p-5 text-sm text-ink-soft">
        No dates set for this one yet. Check back soon.
      </p>
    );
  }

  const TIERS = [
    { key: "full" as const, label: "Full price", cents: klass.full_price_cents },
    { key: "reduced" as const, label: "Reduced", cents: klass.reduced_price_cents },
    {
      key: "subsidized" as const,
      label: "Subsidized",
      cents: klass.subsidized_price_cents,
    },
  ];

  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">Which evening</span>
        <select name="sessionId" required className={cn(field, "mt-1.5")}>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {dateTimeRange(s.starts_at, s.ends_at)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="eyebrow !text-[0.6rem] text-bark">
          What you&rsquo;ll pay
        </legend>
        <p className="mt-1.5 text-sm text-ink-soft">
          Pick whichever is right for you. Nobody is told which you chose, and
          the person teaching is paid the same either way.
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {TIERS.map((t) => (
            <label
              key={t.key}
              className={cn(
                "cursor-pointer rounded-[var(--radius-card)] border p-4 text-center transition-colors",
                tier === t.key
                  ? "border-olive bg-sage-pale/50"
                  : "border-tan/30 hover:border-olive/40",
              )}
            >
              <input
                type="radio"
                name="tier"
                value={t.key}
                className="sr-only"
                checked={tier === t.key}
                onChange={() => setTier(t.key)}
              />
              <span className="block font-display text-xl font-semibold text-olive-deep">
                {moneyExact(t.cents)}
              </span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {t.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {hasCredits && (
        <label className="flex items-start gap-3 rounded-[var(--radius-card)] bg-parchment/70 p-4 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="useCredits"
            defaultChecked
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
          />
          <span>
            Use{" "}
            <strong>
              {klass.credit_cost} of my {creditBalance} credits
            </strong>{" "}
            instead of paying on the night.
          </span>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow !text-[0.6rem] text-bark">Your name</span>
          <input name="name" required className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className="eyebrow !text-[0.6rem] text-bark">Email</span>
          <input
            name="email"
            type="email"
            required
            className={cn(field, "mt-1.5")}
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">
          Phone, if you&rsquo;d like
        </span>
        <input name="phone" type="tel" className={cn(field, "mt-1.5")} />
      </label>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-burgundy">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Put me down
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        Nothing is charged now. If not enough people sign up, the class
        doesn&rsquo;t run and we&rsquo;ll tell you the day before —
        you&rsquo;re never left waiting to find out.
      </p>
    </form>
  );
}
