"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import {
  startInspection,
  type ActionResult,
} from "@/app/(admin)/admin/rentals/condition-actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";

/**
 * Begin a move-in or move-out inspection for a tenancy.
 *
 * Defaults to today, because an inspection is recorded while standing in the
 * room — not typed up a week later, which is the habit this is meant to
 * replace.
 */
export function StartInspectionForm({
  tenancies,
}: {
  tenancies: { id: string; label: string }[];
}) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    startInspection,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (result?.ok && result.reportId) {
      router.push(`/admin/rentals/condition/${result.reportId}`);
    }
  }, [result, router]);

  if (tenancies.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-soft">
        No current tenancies to inspect.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Whose">
          <select name="leaseId" required className={inputClass}>
            {tenancies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Which inspection">
          <select name="kind" required className={inputClass}>
            <option value="move_in">Moving in</option>
            <option value="move_out">Moving out</option>
          </select>
        </Field>

        <Field label="Date">
          <input
            type="date"
            name="inspectedOn"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </Field>
      </div>

      <CheckField
        name="tenantPresent"
        label="They were there for it"
        hint="Alberta says they must be given the chance. Worth recording either way."
        defaultChecked
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Start the inspection
        </SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
