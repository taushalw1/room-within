"use client";

import { useActionState, useEffect } from "react";
import { updateContact } from "@/app/(admin)/admin/rentals/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { ContactRow } from "@/lib/data/types";

/**
 * Editing someone's details.
 *
 * Adding a person is a different job — it may also set up a lease — so that
 * lives in AddTenantForm. This one only ever changes who they are.
 */
export function ContactForm({
  contact,
  onSaved,
  onCancel,
}: {
  contact: ContactRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(updateContact, null);

  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="contactId" value={contact.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            name="fullName"
            required
            defaultValue={contact.full_name}
            className={inputClass}
          />
        </Field>
        <Field label="Email" hint="Reminders and invoices go here.">
          <input
            name="email"
            type="email"
            defaultValue={contact.email ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            name="phone"
            type="tel"
            defaultValue={contact.phone ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Business name (if any)">
          <input
            name="organisation"
            defaultValue={contact.organisation ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={contact.notes ?? ""}
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
