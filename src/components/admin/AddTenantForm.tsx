"use client";

import { useActionState, useState } from "react";
import { addTenant } from "@/app/(admin)/admin/rentals/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { money } from "@/lib/format";
import type { UnitRow } from "@/lib/data/types";

export function AddTenantForm({ units }: { units: UnitRow[] }) {
  const [result, action] = useActionState(addTenant, null);
  const [unitId, setUnitId] = useState("");

  const unit = units.find((u) => u.id === unitId);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="fullName" required className={inputClass} />
        </Field>
        <Field label="Email" hint="Reminders and invoices go here.">
          <input name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" className={inputClass} />
        </Field>
        <Field label="Business name (if any)">
          <input name="organisation" className={inputClass} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea name="notes" rows={2} className={`${inputClass} resize-y`} />
      </Field>

      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <Field
          label="Which unit are they renting?"
          hint="Leave as 'Not renting yet' to just add them to your people list."
        >
          <select
            name="unitId"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={inputClass}
          >
            <option value="">Not renting yet</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {money(u.monthly_rate_cents)}/month
              </option>
            ))}
          </select>
        </Field>

        {/* Lease details only matter once a unit has been chosen. */}
        {unitId && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Lease starts">
              <input
                name="startDate"
                type="date"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Monthly rent">
              <input
                name="rent"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={
                  unit ? (unit.monthly_rate_cents / 100).toFixed(2) : ""
                }
                className={inputClass}
              />
            </Field>
            <Field label="Deposit">
              <input
                name="deposit"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  unit ? (unit.monthly_rate_cents / 100).toFixed(2) : ""
                }
                className={inputClass}
              />
            </Field>
            <Field label="Rent due on" hint="Day of the month, 1–28.">
              <input
                name="dueDay"
                type="number"
                min="1"
                max="28"
                defaultValue="1"
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>
          {unitId ? "Add tenant" : "Add to people list"}
        </SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
