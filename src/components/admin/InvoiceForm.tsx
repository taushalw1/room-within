"use client";

import { useActionState } from "react";
import { addDays, format } from "date-fns";
import { createInvoice } from "@/app/(admin)/admin/rentals/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import type { ContactRow } from "@/lib/data/types";

const KINDS = [
  { value: "other", label: "Something else" },
  { value: "rent", label: "Rent" },
  { value: "booking", label: "Room booking" },
  { value: "counselling", label: "Counselling session" },
  { value: "deposit", label: "Deposit" },
];

/**
 * Bill anyone for anything. Monthly rent is raised automatically, so this is
 * for one-offs — a repair recharged to a tenant, a deposit, a session.
 */
export function InvoiceForm({ contacts }: { contacts: ContactRow[] }) {
  const [result, action] = useActionState(createInvoice, null);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who is it for">
          <select name="contactId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Choose someone…
            </option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.organisation ? ` — ${c.organisation}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What kind">
          <select name="kind" defaultValue="other" className={inputClass}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="What it's for"
        hint="This is what they see on the invoice and in the reminder email."
      >
        <input
          name="description"
          required
          placeholder="Replacement door handle, Office 2"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className={inputClass}
          />
        </Field>

        <Field label="GST" hint="Leave at 0 if none.">
          <input
            name="tax"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            className={inputClass}
          />
        </Field>

        <Field label="Due">
          <input
            name="dueDate"
            type="date"
            required
            defaultValue={format(addDays(new Date(), 14), "yyyy-MM-dd")}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Notes" hint="For you — not shown to them.">
        <textarea name="notes" rows={2} className={`${inputClass} resize-y`} />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Create invoice</SubmitButton>
        <Feedback result={result} />
      </div>

      <p className="text-xs text-ink-faint">
        Reminders go out on their own: a few days before it&rsquo;s due, on the
        day, then at 3, 7 and 14 days late.
      </p>
    </form>
  );
}
