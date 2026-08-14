"use client";

import { useActionState } from "react";
import { updateRates } from "@/app/(admin)/admin/settings/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import type { Rates } from "@/lib/data/admin";

export function RatesForm({ rates }: { rates: Rates }) {
  const [result, action] = useActionState(updateRates, null);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Counselling, per hour">
          <input
            name="counsellingHourly"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={(rates.counselling_hourly_cents / 100).toFixed(2)}
            className={inputClass}
          />
        </Field>

        <Field label="GST %" hint="Applied to room bookings.">
          <input
            name="gstPercent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            required
            defaultValue={(rates.gst_rate * 100).toFixed(1)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
