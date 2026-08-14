"use client";

import { useActionState, useEffect } from "react";
import { updateLease } from "@/app/(admin)/admin/rentals/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";
import type { LeaseRow, UnitRow } from "@/lib/data/types";

export function LeaseForm({
  lease,
  units,
  tenantName,
  onSaved,
  onCancel,
}: {
  lease: LeaseRow;
  units: UnitRow[];
  tenantName: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(updateLease, null);

  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="leaseId" value={lease.id} />

      <p className="text-sm text-ink-soft">
        Tenancy for <strong className="text-ink">{tenantName}</strong>. To
        change who the tenant is, end this tenancy and start a new one — that
        keeps each person&rsquo;s payment history with them.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Unit">
          <select
            name="unitId"
            defaultValue={lease.unit_id}
            className={inputClass}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {money(u.monthly_rate_cents)}/month
              </option>
            ))}
          </select>
        </Field>

        <Field label="Monthly rent">
          <input
            name="rent"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={(lease.rent_cents / 100).toFixed(2)}
            className={inputClass}
          />
        </Field>

        <Field label="Deposit held">
          <input
            name="deposit"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(lease.deposit_cents / 100).toFixed(2)}
            className={inputClass}
          />
        </Field>

        <Field label="Started">
          <input
            name="startDate"
            type="date"
            required
            defaultValue={lease.start_date}
            className={inputClass}
          />
        </Field>

        <Field label="Ends" hint="Leave empty if it's ongoing.">
          <input
            name="endDate"
            type="date"
            defaultValue={lease.end_date ?? ""}
            className={inputClass}
          />
        </Field>

        <Field label="Rent due on" hint="Day of the month, 1–28.">
          <input
            name="dueDay"
            type="number"
            min="1"
            max="28"
            required
            defaultValue={lease.due_day}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Status">
        <select
          name="status"
          defaultValue={lease.status}
          className={inputClass}
        >
          <option value="active">Active — currently renting</option>
          <option value="pending">Pending — agreed but not started</option>
          <option value="ended">Ended — moved out</option>
        </select>
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={lease.notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save changes</SubmitButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}
