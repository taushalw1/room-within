"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import {
  addDepositEntry,
  checkMoveOutItem,
  recordInspection,
  settleMoveOut,
  startMoveOut,
} from "@/app/(admin)/admin/rentals/move-out-actions";
import { Button } from "@/components/ui/Button";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Table";
import { moneyExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DepositEntryRow, MoveOutItemRow, MoveOutRow } from "@/lib/data/types";

const today = () => new Date().toISOString().slice(0, 10);

/** Begin ending a tenancy. */
export function StartMoveOutForm({
  tenancies,
}: {
  tenancies: { id: string; label: string }[];
}) {
  const [result, action] = useActionState(startMoveOut, null);

  if (tenancies.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-soft">
        No active tenancies to end.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <Field label="Which tenancy">
        <select name="leaseId" required className={inputClass}>
          {tenancies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Last day" hint="The day they're actually out.">
        <input
          name="leavingOn"
          type="date"
          required
          defaultValue={today()}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>Start the clean-out list</SubmitButton>
        <Feedback result={result} />
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        They&rsquo;ll see the list in their account straight away, and can work
        through it before the walk-through.
      </p>
    </form>
  );
}

/** One line at the walk-through: what they said, and what you found. */
export function ItemVerdict({ item }: { item: MoveOutItemRow }) {
  const [result, action] = useActionState(checkMoveOutItem, null);
  const [verdict, setVerdict] = useState<"ok" | "not-ok" | "unseen">(
    item.checked_by_admin === null ? "unseen" : item.checked_by_admin ? "ok" : "not-ok",
  );

  return (
    <li className="px-5 py-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="moveOutId" value={item.move_out_id} />
        <input type="hidden" name="verdict" value={verdict} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-ink">{item.title}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{item.area}</p>
            {item.tenant_note && (
              <p className="mt-1 text-sm italic text-ink-soft">
                They said: {item.tenant_note}
              </p>
            )}
          </div>
          <Badge tone={item.done_by_tenant ? "good" : "warn"}>
            {item.done_by_tenant ? "They ticked it" : "Not ticked"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "ok", label: "Fine", tone: "bg-sage-pale text-olive-deep" },
              { key: "not-ok", label: "Not right", tone: "bg-burgundy/10 text-burgundy" },
              { key: "unseen", label: "Not looked at", tone: "bg-tan/20 text-bark" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={(e) => {
                setVerdict(option.key);
                // The verdict rides in a hidden field, so the submit has to
                // wait until React has written the new value into the DOM.
                const form = e.currentTarget.form;
                requestAnimationFrame(() => form?.requestSubmit());
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                verdict === option.key
                  ? option.tone
                  : "bg-transparent text-ink-faint hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {verdict === "not-ok" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              name="note"
              defaultValue={item.admin_note ?? ""}
              placeholder="What was wrong, and what it took to put right"
              className={`${inputClass} text-sm`}
            />
            <input
              name="charge"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                item.charge_cents === null ? "" : (item.charge_cents / 100).toFixed(2)
              }
              placeholder="Cost"
              className={`${inputClass} text-sm sm:w-32`}
            />
            <div className="sm:col-span-2">
              <SubmitButton>Save this line</SubmitButton>
            </div>
          </div>
        )}

        <Feedback result={result} />
      </form>
    </li>
  );
}

/** The walk-through: the date, and what you thought overall. */
export function InspectionForm({ moveOut }: { moveOut: MoveOutRow }) {
  const [result, action] = useActionState(recordInspection, null);

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="moveOutId" value={moveOut.id} />
      <Field label="Day you looked round">
        <input
          name="inspectedOn"
          type="date"
          required
          defaultValue={moveOut.inspected_on ?? today()}
          className={inputClass}
        />
      </Field>
      <Field
        label="Notes"
        hint="Anything the line-by-line doesn't capture. Photographs are worth more than words here."
      >
        <textarea
          name="notes"
          rows={4}
          defaultValue={moveOut.inspection_notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>Record the walk-through</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

const KIND_WORDS: Record<DepositEntryRow["kind"], string> = {
  held: "Taken",
  interest: "Interest",
  deduction: "Deducted",
  returned: "Returned",
};

/**
 * The deposit, as it stands.
 *
 * Shown as the movements rather than a figure, because the movements are what
 * she would have to produce if it were ever questioned.
 */
export function DepositLedger({
  entries,
  leaseId,
  moveOutId,
  evidenceUrls,
}: {
  entries: DepositEntryRow[];
  leaseId: string;
  moveOutId: string | null;
  evidenceUrls: (string | null)[];
}) {
  const [result, action] = useActionState(addDepositEntry, null);
  const [open, setOpen] = useState(false);

  const balance = entries.reduce((total, entry) => total + entry.amount_cents, 0);

  return (
    <div>
      <ul className="divide-y divide-tan/20 border-b border-tan/20">
        {entries.length === 0 && (
          <li className="px-5 py-5 text-sm text-ink-soft">
            Nothing recorded yet.
          </li>
        )}
        {entries.map((entry, i) => (
          <li key={entry.id} className="flex items-start gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] text-ink">{entry.reason}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {KIND_WORDS[entry.kind]} · {entry.occurred_on}
                {evidenceUrls[i] && (
                  <>
                    {" · "}
                    <a
                      href={evidenceUrls[i] ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      receipt
                    </a>
                  </>
                )}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 font-mono text-sm",
                entry.amount_cents < 0 ? "text-burgundy" : "text-olive-deep",
              )}
            >
              {entry.amount_cents < 0 ? "−" : "+"}
              {moneyExact(Math.abs(entry.amount_cents))}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between bg-parchment px-5 py-3">
        <p className="eyebrow !text-[0.6rem] text-bark">Still held</p>
        <p className="font-display text-2xl font-semibold text-olive-deep">
          {moneyExact(balance)}
        </p>
      </div>

      {open ? (
        <form action={action} className="space-y-4 border-t border-tan/20 px-5 py-5">
          <input type="hidden" name="leaseId" value={leaseId} />
          {moveOutId && <input type="hidden" name="moveOutId" value={moveOutId} />}

          <Field label="What is this">
            <select name="kind" required className={inputClass}>
              <option value="deduction">Something taken off</option>
              <option value="returned">Money given back</option>
              <option value="held">More deposit taken</option>
              <option value="interest">Interest added</option>
            </select>
          </Field>

          <Field label="How much" hint="Always a positive number — the kind decides which way it goes.">
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              className={inputClass}
            />
          </Field>

          <Field label="What for" hint="Specific enough to stand up on its own in six months.">
            <input
              name="reason"
              required
              placeholder="Oven cleaning — invoice from Dale"
              className={inputClass}
            />
          </Field>

          <Field label="When">
            <input
              name="occurredOn"
              type="date"
              required
              defaultValue={today()}
              className={inputClass}
            />
          </Field>

          <Field label="Receipt or photo" hint="A deduction with no evidence is one you may not get to keep.">
            <input
              name="receipt"
              type="file"
              accept="image/*,application/pdf"
              className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-sage-pale file:px-3 file:py-1 file:text-xs`}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Add it</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Feedback result={result} />
          </div>
        </form>
      ) : (
        <div className="border-t border-tan/20 px-5 py-4">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Record a movement
          </Button>
          {result?.ok && <Feedback result={result} />}
        </div>
      )}
    </div>
  );
}

/** Close the whole thing off. */
export function SettleButton({ moveOutId }: { moveOutId: string }) {
  const [result, action] = useActionState(settleMoveOut, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 px-5 py-5">
      <input type="hidden" name="moveOutId" value={moveOutId} />
      <Button type="submit">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Settle and close the tenancy
      </Button>
      <Feedback result={result} />
    </form>
  );
}
