"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, Check, Plus } from "lucide-react";
import {
  payBill,
  saveBill,
  voidBill,
  type ActionResult,
} from "@/app/(admin)/admin/finance/costs/actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateShort, moneyExact } from "@/lib/format";
import type { BillRow } from "@/lib/data/types";

/**
 * What she owes and hasn't paid.
 *
 * Marking one paid creates the cost with the bill's own amounts rather than
 * asking her to type them again — the figures are already on the bill, and
 * retyping them is only an opportunity to differ from it.
 */
export function BillsPanel({
  bills,
  categories,
  today,
}: {
  bills: BillRow[];
  categories: string[];
  /** Passed in from the server so the page and the server agree on the date. */
  today: string;
}) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    saveBill,
    null,
  );
  const [adding, setAdding] = useState(false);

  const open = bills.filter((b) => b.status === "open");
  const settled = bills.filter((b) => b.status !== "open");

  return (
    <div>
      {open.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Nothing outstanding. When an invoice arrives that you haven&rsquo;t
          paid yet, put it here and it will show up in your forecast.
        </p>
      ) : (
        open.map((bill) => (
          <BillRowView key={bill.id} bill={bill} today={today} />
        ))
      )}

      <div className="border-t border-tan/20 px-5 py-4">
        {!adding ? (
          <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add a bill you&rsquo;ve been sent
          </Button>
        ) : (
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who it's from">
                <input name="vendor" required className={inputClass} />
              </Field>
              <Field label="What kind of cost">
                <input
                  name="category"
                  required
                  list="bill-categories"
                  className={inputClass}
                />
                <datalist id="bill-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="What it's for">
              <input name="description" className={inputClass} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Amount" hint="What the bill says, GST included.">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="GST, if you know it" hint="Left blank, it's worked out.">
                <input name="tax" type="number" step="0.01" min="0" className={inputClass} />
              </Field>
              <Field label="Due">
                <input name="dueOn" type="date" required className={inputClass} />
              </Field>
            </div>

            <Field label="Anything to remember">
              <input name="notes" className={inputClass} />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>Save it</SubmitButton>
              <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Feedback result={result} />
            </div>
          </form>
        )}
      </div>

      {settled.length > 0 && (
        <details className="border-t border-tan/20">
          <summary className="cursor-pointer px-5 py-3 text-sm text-bark">
            {settled.length} already dealt with
          </summary>
          <div className="pb-2">
            {settled.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm opacity-70"
              >
                <span>
                  {bill.vendor}
                  <span className="ml-2 text-xs text-ink-faint">
                    {dateShort(bill.due_on)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {moneyExact(bill.amount_cents + bill.tax_cents)}
                  <Badge tone={bill.status === "paid" ? "good" : "neutral"}>
                    {bill.status === "paid" ? "paid" : "cancelled"}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BillRowView({ bill, today }: { bill: BillRow; today: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [paying, setPaying] = useState(false);

  const late = bill.due_on < today;
  const total = bill.amount_cents + bill.tax_cents;

  function run(action: (fd: FormData) => Promise<ActionResult>, extra?: Record<string, string>) {
    const fd = new FormData();
    fd.set("billId", bill.id);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    start(async () => setResult(await action(fd)));
  }

  return (
    <div className={`border-b border-tan/20 px-5 py-4 ${late ? "bg-blush/25" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{bill.vendor}</p>
          <p className="text-sm text-ink-soft">
            {bill.description ?? bill.category}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Due {dateShort(bill.due_on)}
            {late ? " — overdue" : ""} · {bill.category}
          </p>
          {bill.notes && (
            <p className="mt-1 text-xs italic text-ink-soft">{bill.notes}</p>
          )}
        </div>
        <p
          className={`shrink-0 font-display text-lg font-semibold ${
            late ? "text-burgundy" : "text-ink"
          }`}
        >
          {moneyExact(total)}
        </p>
      </div>

      {!paying ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" type="button" onClick={() => setPaying(true)}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            I&rsquo;ve paid this
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={pending}
            onClick={() => run(voidBill)}
          >
            <Ban className="h-3.5 w-3.5" aria-hidden />
            Cancel it
          </Button>
        </div>
      ) : (
        <form
          className="mt-2.5 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const paidOn = new FormData(e.currentTarget).get("paidOn");
            run(payBill, { paidOn: String(paidOn ?? "") });
            setPaying(false);
          }}
        >
          <label className="text-xs text-bark">
            <span className="eyebrow !text-[0.58rem] block">When did you pay it?</span>
            <input
              name="paidOn"
              type="date"
              required
              defaultValue={today}
              className={`${inputClass} mt-1`}
            />
          </label>
          <Button size="sm" type="submit" disabled={pending}>
            Record it
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setPaying(false)}>
            Cancel
          </Button>
        </form>
      )}

      {result && (
        <p
          role="status"
          className={`mt-2 text-sm ${result.ok ? "text-olive" : "text-burgundy"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
