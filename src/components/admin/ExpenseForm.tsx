"use client";

import { useActionState, useEffect } from "react";
import { format } from "date-fns";
import { addExpense, updateExpense } from "@/app/(admin)/admin/finance/actions";
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

  useEffect(() => {
    if (result?.ok && editing) onSaved?.();
  }, [result, editing, onSaved]);

  // Offer whatever she's used before first, then the standard list.
  const categories = [...new Set([...existingCategories, ...COMMON_CATEGORIES])];

  const listId = editing ? `cat-${expense!.id}` : "cat-new";
  const methodListId = editing ? `pay-${expense!.id}` : "pay-new";

  return (
    <form action={action} className="space-y-5">
      {expense && <input type="hidden" name="expenseId" value={expense.id} />}

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
