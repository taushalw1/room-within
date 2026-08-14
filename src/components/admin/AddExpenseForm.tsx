"use client";

import { useActionState } from "react";
import { format } from "date-fns";
import { addExpense } from "@/app/(admin)/admin/finance/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";

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

export function AddExpenseForm({
  existingCategories,
}: {
  existingCategories: string[];
}) {
  const [result, action] = useActionState(addExpense, null);

  // Offer whatever she's used before first, then the standard list.
  const categories = [
    ...new Set([...existingCategories, ...COMMON_CATEGORIES]),
  ];

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date">
          <input
            name="incurredOn"
            type="date"
            required
            defaultValue={format(new Date(), "yyyy-MM-dd")}
            className={inputClass}
          />
        </Field>

        <Field label="Who was it paid to">
          <input
            name="vendor"
            placeholder="Taber Building Supply"
            className={inputClass}
          />
        </Field>

        <Field label="Category" hint="Pick one or type your own.">
          <input
            name="category"
            required
            list="expense-categories"
            placeholder="Repairs"
            className={inputClass}
          />
          <datalist id="expense-categories">
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
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What it was for">
          <input
            name="description"
            placeholder="Weatherstripping and door hardware"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How it was paid">
            <input
              name="paymentMethod"
              list="payment-methods"
              className={inputClass}
            />
            <datalist id="payment-methods">
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
              placeholder="auto"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field label="Notes">
        <textarea name="notes" rows={2} className={`${inputClass} resize-y`} />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Record cost</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
