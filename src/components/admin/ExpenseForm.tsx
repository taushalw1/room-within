"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Camera, Loader2 } from "lucide-react";
import {
  addExpense,
  readReceiptPhoto,
  updateExpense,
} from "@/app/(admin)/admin/finance/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { ExpenseRow } from "@/lib/data/types";

const COMMON_CATEGORIES = [
  "Repairs",
  "Utilities",
  "Insurance",
  "Cleaning",
  "Marketing",
  "Supplies",
  "Professional fees",
  "Mortgage & interest",
  "Property tax",
  "Other",
];

const PAYMENT_METHODS = [
  "Debit",
  "Credit card",
  "e-Transfer",
  "Cheque",
  "Cash",
  "Pre-authorised",
];

/** One form for both adding and editing a cost. */
export function ExpenseForm({
  existingCategories,
  expense,
  onSaved,
  onCancel,
}: {
  existingCategories: string[];
  expense?: ExpenseRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(expense);
  const [result, action] = useActionState(
    editing ? updateExpense : addExpense,
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  /**
   * Photograph a receipt and let it fill the boxes in.
   *
   * Fields come back one at a time and only when they were legible, so a
   * receipt read half-correctly still saves most of the typing. Nothing that
   * came back null overwrites anything already typed — a blank from the
   * reader is "couldn't read it", not "it's empty".
   */
  async function readPhoto(file: File) {
    setReading(true);
    setReadNote(null);
    setReadError(null);

    const data = new FormData();
    data.set("receipt", file);

    const out = await readReceiptPhoto(null, data);
    setReading(false);

    if (!out.ok) {
      setReadError(out.message);
      return;
    }

    const form = formRef.current;
    if (!form) return;

    const fill = (name: string, value: string | number | null) => {
      if (value === null || value === "") return;
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = String(value);
    };

    const r = out.reading;
    fill("incurredOn", r.incurred_on);
    fill("vendor", r.vendor);
    fill("category", r.category);
    fill("amount", r.total === null ? null : r.total.toFixed(2));
    fill("tax", r.tax === null ? null : r.tax.toFixed(2));
    fill("paymentMethod", r.payment_method);
    fill("description", r.description);

    const missing = r.unreadable.length > 0
      ? `Couldn't read: ${r.unreadable.join(", ")}. `
      : "";

    setReadNote(
      `${missing}${r.note ?? ""}`.trim() ||
        "Read it. Check the total and the date against the paper before you save.",
    );
  }

  useEffect(() => {
    if (result?.ok && editing) onSaved?.();
  }, [result, editing, onSaved]);

  // Offer whatever she's used before first, then the standard list.
  const categories = [...new Set([...existingCategories, ...COMMON_CATEGORIES])];

  const listId = editing ? `cat-${expense!.id}` : "cat-new";
  const methodListId = editing ? `pay-${expense!.id}` : "pay-new";

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {expense && <input type="hidden" name="expenseId" value={expense.id} />}

      {/* Entering costs by hand is the chore most likely to be skipped, and
          skipped costs are what make a year end take a weekend. */}
      <div className="rounded-[var(--radius-card)] border border-sage/40 bg-sage-pale/40 px-4 py-3.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-olive-deep">
          {reading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
          {reading ? "Reading it…" : "Take a photo of the receipt"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={reading}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          It fills the boxes in below. Nothing is saved until you press the
          button, so check the total and the date against the paper first.
        </p>
        {readNote && (
          <p className="mt-2 text-sm leading-relaxed text-bark">{readNote}</p>
        )}
        {readError && (
          <p className="mt-2 text-sm leading-relaxed text-burgundy">{readError}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date">
          <input
            name="incurredOn"
            type="date"
            required
            defaultValue={
              expense?.incurred_on ?? format(new Date(), "yyyy-MM-dd")
            }
            className={inputClass}
          />
        </Field>

        <Field label="Who was it paid to">
          <input
            name="vendor"
            defaultValue={expense?.vendor ?? ""}
            placeholder="Taber Building Supply"
            className={inputClass}
          />
        </Field>

        <Field label="Category" hint="Pick one or type your own.">
          <input
            name="category"
            required
            list={listId}
            defaultValue={expense?.category ?? ""}
            placeholder="Repairs"
            className={inputClass}
          />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="Amount" hint="The total that left the account.">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={
              expense ? (expense.amount_cents / 100).toFixed(2) : ""
            }
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What it was for">
          <input
            name="description"
            defaultValue={expense?.description ?? ""}
            placeholder="Weatherstripping and door hardware"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How it was paid">
            <input
              name="paymentMethod"
              list={methodListId}
              defaultValue={expense?.payment_method ?? ""}
              className={inputClass}
            />
            <datalist id={methodListId}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>

          <Field label="GST" hint="Leave blank to work it out.">
            <input
              name="tax"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                expense && expense.tax_cents > 0
                  ? (expense.tax_cents / 100).toFixed(2)
                  : ""
              }
              placeholder="auto"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={expense?.notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{editing ? "Save changes" : "Record cost"}</SubmitButton>
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
