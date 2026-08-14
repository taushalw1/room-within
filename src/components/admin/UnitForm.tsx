"use client";

import { useActionState, useEffect } from "react";
import { createUnit, updateUnit } from "@/app/(admin)/admin/settings/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { UnitRow } from "@/lib/data/types";

const KINDS: { value: UnitRow["kind"]; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "suite", label: "Residential suite" },
  { value: "retail", label: "Retail / shopfront" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Something else" },
];

/**
 * A unit is a part of the building let on a monthly lease — an office or a
 * suite — as opposed to a room, which is booked by the hour or the day.
 */
export function UnitForm({
  unit,
  onSaved,
  onCancel,
}: {
  unit?: UnitRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(unit);
  const [result, action] = useActionState(editing ? updateUnit : createUnit, null);

  useEffect(() => {
    if (result?.ok && editing) onSaved?.();
  }, [result, editing, onSaved]);

  return (
    <form action={action} className="space-y-5">
      {unit && <input type="hidden" name="unitId" value={unit.id} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Unit name" className="lg:col-span-2">
          <input
            name="name"
            required
            defaultValue={unit?.name}
            placeholder="Office 3 — Corner"
            className={inputClass}
          />
        </Field>

        <Field label="What kind">
          <select
            name="kind"
            defaultValue={unit?.kind ?? "office"}
            className={inputClass}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Floor" hint="Main, Upper…">
          <input
            name="floor"
            defaultValue={unit?.floor ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          rows={2}
          defaultValue={unit?.description ?? ""}
          placeholder="Street-facing office with the big window."
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="Monthly rent"
        hint="The asking rent. Each tenancy can be agreed at a different figure."
        className="max-w-xs"
      >
        <input
          name="monthlyRate"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={unit ? (unit.monthly_rate_cents / 100).toFixed(2) : ""}
          placeholder="0.00"
          className={inputClass}
        />
      </Field>

      <CheckField
        name="isActive"
        label="This unit is available to let"
        defaultChecked={unit ? unit.is_active : true}
        hint="Untick for a unit that's out of use — it stays on file with its history."
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{editing ? "Save changes" : "Add unit"}</SubmitButton>
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
