"use client";

import { useActionState, useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { startDonation, type DonateResult } from "@/app/(site)/support/actions";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 text-[0.95rem] placeholder:text-ink-faint";

/**
 * Preset amounts, with what each one buys.
 *
 * Naming the thing a gift pays for raises giving more than a bare number
 * does — and for a building fund, people want to picture what they're
 * mending.
 */
const PRESETS = [
  { amount: 25, note: "A box of supplies" },
  { amount: 100, note: "A window repaired" },
  { amount: 250, note: "A day of a tradesperson" },
  { amount: 1000, note: "A room made usable" },
];

export function DonateForm() {
  const [result, action, pending] = useActionState<DonateResult | null, FormData>(
    startDonation,
    null,
  );
  const [amount, setAmount] = useState<number | "">(100);
  const [custom, setCustom] = useState(false);

  // Stripe Checkout is on Stripe's own domain, so we leave the site.
  useEffect(() => {
    if (result?.status === "redirect") window.location.href = result.url;
  }, [result]);

  return (
    <form action={action} className="space-y-5 text-left">
      <input type="hidden" name="amount" value={amount === "" ? "" : amount} />

      <fieldset>
        <legend className="eyebrow !text-[0.6rem] text-bark">How much</legend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <label
              key={p.amount}
              className={cn(
                "cursor-pointer rounded-[var(--radius-card)] border p-4 transition-colors",
                !custom && amount === p.amount
                  ? "border-olive bg-sage-pale/50"
                  : "border-tan/30 hover:border-olive/40",
              )}
            >
              <input
                type="radio"
                name="preset"
                className="sr-only"
                checked={!custom && amount === p.amount}
                onChange={() => {
                  setCustom(false);
                  setAmount(p.amount);
                }}
              />
              <span className="block font-display text-xl font-semibold text-olive-deep">
                ${p.amount}
              </span>
              <span className="mt-0.5 block text-xs text-ink-soft">{p.note}</span>
            </label>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-sm text-ink-soft">Or another amount</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-ink-soft">$</span>
            <input
              type="number"
              min="5"
              step="1"
              value={custom && amount !== "" ? amount : ""}
              onChange={(e) => {
                setCustom(true);
                setAmount(e.target.value === "" ? "" : Number(e.target.value));
              }}
              onFocus={() => setCustom(true)}
              placeholder="50"
              className={cn(field, "max-w-[10rem]")}
            />
          </div>
        </label>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow !text-[0.6rem] text-bark">Your name</span>
          <input name="name" className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className="eyebrow !text-[0.6rem] text-bark">Email</span>
          <input
            name="email"
            type="email"
            required
            className={cn(field, "mt-1.5")}
          />
          <span className="mt-1 block text-xs text-ink-faint">
            For your receipt.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">
          A message, if you&rsquo;d like
        </span>
        <textarea
          name="message"
          rows={2}
          placeholder="Why this matters to you, or who you'd like it to be in memory of."
          className={cn(field, "mt-1.5 resize-y")}
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="anonymous"
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
        />
        <span>Keep my donation anonymous</span>
      </label>

      {result?.status === "error" && (
        <p role="alert" className="text-sm text-burgundy">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending || amount === ""}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Heart className="h-4 w-4" aria-hidden />
        )}
        {amount === "" ? "Choose an amount" : `Donate $${amount}`}
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        Card details are handled by Stripe and never touch this website. Room
        Within is not yet a registered charity, so donations are not
        tax-deductible — we&rsquo;ll say so plainly rather than let anyone
        assume otherwise.
      </p>
    </form>
  );
}
