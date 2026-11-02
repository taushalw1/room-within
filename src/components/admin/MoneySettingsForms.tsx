"use client";

import { useActionState, useState } from "react";
import {
  updateDigestSettings,
  updateLateFeeSettings,
} from "@/app/(admin)/admin/settings/actions";
import { CheckField, Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import type { DigestSettings, LateFeeSettings } from "@/lib/data/settings";

const dollars = (cents: number) => (cents / 100).toFixed(2);

/**
 * Late fees.
 *
 * Written so that the page itself is the warning. Charging a fee to somebody
 * who is already short is a decision with a person on the other end of it,
 * and in Alberta it has to be in the agreement before it can be charged at
 * all — so the form says that out loud rather than leaving it to be
 * discovered.
 */
export function LateFeeForm({ settings }: { settings: LateFeeSettings }) {
  const [result, action] = useActionState(updateLateFeeSettings, null);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [kind, setKind] = useState<"fixed" | "percent">(settings.kind);

  return (
    <form action={action} className="space-y-5">
      <CheckField
        name="enabled"
        label="Charge a late fee on overdue invoices"
        hint="Off unless you turn it on. Nothing is charged to anybody while this is off."
        defaultChecked={settings.enabled}
        onChange={(e) => setEnabled(e.currentTarget.checked)}
      />

      {enabled && (
        <div className="space-y-5 rounded-[var(--radius-card)] border border-burgundy/20 bg-burgundy/5 p-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            A fee is added <strong>once per invoice</strong> — never again the
            next month on the same debt. It appears as its own small invoice so
            the tenant can see exactly what it is.
          </p>
          <p className="text-sm leading-relaxed text-burgundy">
            Before you switch this on: a late fee can only be charged if it is
            written into the agreement the tenant signed. If it isn&rsquo;t in
            theirs, add it to the next one rather than charging it now.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Days of grace"
              hint="How long after the due date before anything is added."
            >
              <input
                name="graceDays"
                type="number"
                min={0}
                max={60}
                defaultValue={settings.grace_days}
                className={inputClass}
              />
            </Field>

            <Field label="How it's worked out">
              <select
                name="kind"
                defaultValue={settings.kind}
                onChange={(e) => setKind(e.currentTarget.value as "fixed" | "percent")}
                className={inputClass}
              >
                <option value="fixed">A flat amount</option>
                <option value="percent">A percentage of what's owed</option>
              </select>
            </Field>

            {kind === "fixed" ? (
              <Field label="Amount">
                <div className="flex items-center gap-2">
                  <span className="text-ink-soft">$</span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={dollars(settings.amount_cents)}
                    className={inputClass}
                  />
                </div>
              </Field>
            ) : (
              <Field label="Percentage">
                <div className="flex items-center gap-2">
                  <input
                    name="percent"
                    type="number"
                    step="0.1"
                    min={0}
                    max={25}
                    defaultValue={settings.percent}
                    className={inputClass}
                  />
                  <span className="text-ink-soft">%</span>
                </div>
              </Field>
            )}

            <Field
              label="Never more than"
              hint="A ceiling, so a percentage on a big invoice can't run away. Zero means no ceiling."
            >
              <div className="flex items-center gap-2">
                <span className="text-ink-soft">$</span>
                <input
                  name="max"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={dollars(settings.max_cents)}
                  className={inputClass}
                />
              </div>
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="eyebrow !text-[0.6rem] text-bark">
              Which invoices it applies to
            </legend>
            <CheckField
              name="appliesToRent"
              label="Rent"
              defaultChecked={settings.applies_to.includes("rent")}
            />
            <CheckField
              name="appliesToBookings"
              label="Room bookings"
              defaultChecked={settings.applies_to.includes("booking")}
            />
            <CheckField
              name="appliesToOther"
              label="Everything else"
              defaultChecked={settings.applies_to.includes("other")}
            />
          </fieldset>
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/** The morning note. */
export function DigestForm({ settings }: { settings: DigestSettings }) {
  const [result, action] = useActionState(updateDigestSettings, null);

  return (
    <form action={action} className="space-y-5">
      <CheckField
        name="enabled"
        label="Send me a note each morning"
        hint="What needs you today: repairs waiting, who's in the building, tenancies running out, what's overdue. Nothing arrives on a morning with nothing to say."
        defaultChecked={settings.enabled}
      />
      <div className="flex items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
