"use client";

import { useActionState } from "react";
import {
  updateClassSettings,
  updateCreditSettings,
} from "@/app/(admin)/admin/settings/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { creditValueCents, creditWarnings } from "@/lib/credits";
import { moneyExact } from "@/lib/format";
import type { ClassSettings, CreditSettings } from "@/lib/data/types";

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function ClassSettingsForm({ settings }: { settings: ClassSettings }) {
  const [result, action] = useActionState(updateClassSettings, null);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Your share of a class fee"
          hint="The rest goes to the instructor. The same for everybody, so nothing is negotiated."
        >
          <div className="flex items-center gap-2">
            <input
              name="hubSplitPercent"
              type="number"
              min="0"
              max="100"
              required
              defaultValue={settings.hub_split_percent}
              className={inputClass}
            />
            <span className="text-ink-soft">%</span>
          </div>
        </Field>
        <Field
          label="Decide a class this many hours before"
          hint="If it hasn't got its numbers by then, it cancels itself and credits go back."
        >
          <input
            name="confirmHoursBefore"
            type="number"
            min="1"
            max="168"
            required
            defaultValue={settings.confirm_hours_before}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <p className="eyebrow !text-[0.6rem] text-bark">Earned standing</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          What an instructor has to reach before they&rsquo;re listed first and
          get first pick of dates. Written as numbers so it can be shown to
          somebody as a checklist rather than argued about.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Classes taught">
            <input
              name="earnedAfterSessions"
              type="number"
              min="1"
              required
              defaultValue={settings.earned_after_sessions}
              className={inputClass}
            />
          </Field>
          <Field label="Average people per class">
            <input
              name="earnedMinAverage"
              type="number"
              min="0"
              step="0.5"
              required
              defaultValue={settings.earned_min_average_attendance}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function CreditSettingsForm({ settings }: { settings: CreditSettings }) {
  const [result, action] = useActionState(updateCreditSettings, null);
  const warnings = creditWarnings(settings);

  return (
    <form action={action} className="space-y-5">
      {warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-[var(--radius-card)] bg-blush/50 p-4 text-sm text-burgundy">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
          <p className="eyebrow !text-[0.6rem] text-bark">Individual plan</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Per month">
              <input
                name="individualPrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={dollars(settings.individual_price_cents)}
                className={inputClass}
              />
            </Field>
            <Field label="Credits">
              <input
                name="individualCredits"
                type="number"
                min="0"
                required
                defaultValue={settings.individual_credits}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-2.5 text-xs text-ink-faint">
            Works out at {moneyExact(creditValueCents("individual", settings))} a
            class.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
          <p className="eyebrow !text-[0.6rem] text-bark">Family plan</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Per month">
              <input
                name="familyPrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={dollars(settings.family_price_cents)}
                className={inputClass}
              />
            </Field>
            <Field label="Credits">
              <input
                name="familyCredits"
                type="number"
                min="0"
                required
                defaultValue={settings.family_credits}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-2.5 text-xs text-ink-faint">
            One shared pool for the household —{" "}
            {moneyExact(creditValueCents("family", settings))} a class. Worth
            keeping it under two individual plans, or nobody upgrades.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Drop-in, no plan">
          <input
            name="dropin"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={dollars(settings.dropin_cents)}
            className={inputClass}
          />
        </Field>
        <Field label="Extra credit each">
          <input
            name="extraCredit"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={dollars(settings.extra_credit_cents)}
            className={inputClass}
          />
        </Field>
        <Field label="Credits last (months)">
          <input
            name="rolloverMonths"
            type="number"
            min="0"
            max="24"
            required
            defaultValue={settings.rollover_months}
            className={inputClass}
          />
        </Field>
        <Field
          label="Family cap per class"
          hint="Most credits a household can put into one class in a month."
        >
          <input
            name="familySameClassCap"
            type="number"
            min="0"
            required
            defaultValue={settings.family_same_class_cap}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
      <p className="text-xs text-ink-faint">
        These are the starting figures whenever you add a member. Changing them
        doesn&rsquo;t alter what anyone already pays.
      </p>
    </form>
  );
}
