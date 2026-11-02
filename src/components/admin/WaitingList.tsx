"use client";

import { useActionState, useState } from "react";
import { Phone, Mail, Plus } from "lucide-react";
import {
  addToWaitingList,
  updateWaitingEntry,
} from "@/app/(admin)/admin/rentals/waiting-actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { dateShort, moneyExact } from "@/lib/format";
import type { UnitRow, WaitingListRow } from "@/lib/data/types";

/**
 * Who is waiting, and which of them an empty room would suit.
 *
 * The matching is deliberately crude — kind of unit and budget, nothing
 * cleverer. It isn't trying to choose for her; it is trying to put the right
 * two names in front of her on the morning a room comes free, rather than
 * leaving them in a notebook.
 */
export function WaitingList({
  entries,
  emptyUnits,
}: {
  entries: WaitingListRow[];
  emptyUnits: UnitRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [addResult, add] = useActionState(addToWaitingList, null);
  const [updateResult, update] = useActionState(updateWaitingEntry, null);

  const suits = (entry: WaitingListRow) =>
    emptyUnits.filter(
      (u) =>
        (entry.unit_kinds.length === 0 || entry.unit_kinds.includes(u.kind)) &&
        (entry.budget_cents == null || u.monthly_rate_cents <= entry.budget_cents),
    );

  return (
    <div>
      {entries.length === 0 && !adding && (
        <p className="px-5 py-5 text-sm text-ink-soft">
          Nobody waiting. Worth adding anyone who asks, even when nothing is
          free — an empty room costs its rent every month it stands empty, and
          the only thing that shortens that is knowing who to ring.
        </p>
      )}

      <ul className="divide-y divide-tan/20">
        {entries.map((entry) => {
          const matches = suits(entry);
          return (
            <li key={entry.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{entry.full_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-3 text-sm">
                    {entry.phone && (
                      <a
                        href={`tel:${entry.phone.replace(/[^0-9+]/g, "")}`}
                        className="inline-flex items-center gap-1.5 text-olive-deep underline underline-offset-2"
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden />
                        {entry.phone}
                      </a>
                    )}
                    {entry.email && (
                      <a
                        href={`mailto:${entry.email}`}
                        className="inline-flex items-center gap-1.5 text-olive-deep underline underline-offset-2"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                        {entry.email}
                      </a>
                    )}
                  </p>
                  {entry.looking_for && (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {entry.looking_for}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-faint">
                    On the list since {dateShort(entry.created_at)}
                    {entry.budget_cents != null &&
                      ` - up to ${moneyExact(entry.budget_cents)} a month`}
                    {entry.needed_from && ` - needs it from ${dateShort(entry.needed_from)}`}
                    {entry.last_contacted_on
                      ? ` - last spoken to ${dateShort(entry.last_contacted_on)}`
                      : " - never contacted"}
                  </p>
                </div>

                {entry.status === "offered" ? (
                  <Badge tone="info">Offered something</Badge>
                ) : matches.length > 0 ? (
                  <Badge tone="good">
                    {matches.map((u) => u.name).join(", ")} would suit
                  </Badge>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    { value: "offered", label: "Offered them something", contacted: "yes" },
                    { value: "housed", label: "They took it", contacted: "no" },
                    { value: "gone", label: "No longer looking", contacted: "no" },
                  ] as const
                ).map((option) => (
                  <form key={option.value} action={update}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="status" value={option.value} />
                    <input type="hidden" name="contacted" value={option.contacted} />
                    <button
                      type="submit"
                      className="rounded-full bg-tan/15 px-3 py-1 text-xs text-bark transition hover:bg-tan/30"
                    >
                      {option.label}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-tan/20 px-5 py-4">
        {adding ? (
          <form action={add} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="fullName" required className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="phone" className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} />
              </Field>
              <Field label="Most they can pay a month">
                <div className="flex items-center gap-2">
                  <span className="text-ink-soft">$</span>
                  <input name="budget" type="number" step="0.01" min={0} className={inputClass} />
                </div>
              </Field>
            </div>

            <Field label="What they're after" hint="In their words, as much as you can remember.">
              <textarea name="lookingFor" rows={2} className={`${inputClass} resize-y`} />
            </Field>

            <fieldset className="space-y-2">
              <legend className="eyebrow !text-[0.6rem] text-bark">
                What would suit them
              </legend>
              <CheckField name="kindOffice" label="An office" />
              <CheckField name="kindSuite" label="A suite to live in" />
              <CheckField name="kindRetail" label="Retail space" />
              <CheckField name="kindStorage" label="Storage" />
            </fieldset>

            <Field label="When they need it" hint="Leave blank if it's whenever.">
              <input name="neededFrom" type="date" className={inputClass} />
            </Field>

            <Field label="Anything else">
              <textarea name="notes" rows={2} className={`${inputClass} resize-y`} />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>Add them</SubmitButton>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Feedback result={addResult} />
            </div>
          </form>
        ) : (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add somebody
            </Button>
            <Feedback result={addResult} />
            <Feedback result={updateResult} />
          </>
        )}
      </div>
    </div>
  );
}
