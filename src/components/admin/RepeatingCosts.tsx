"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Repeat, StopCircle } from "lucide-react";
import {
  raiseFromRecurring,
  saveRecurringCost,
  stopRecurringCost,
  type ActionResult,
} from "@/app/(admin)/admin/finance/costs/actions";
import { Button } from "@/components/ui/Button";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { CADENCE_LABEL, yearlyCents } from "@/lib/recurring";
import { dateShort, moneyExact } from "@/lib/format";
import type { RecurringCostRow } from "@/lib/data/types";

/**
 * The costs that come round again.
 *
 * Each shows what it works out to over a year as well as what it is each
 * time. A $412 insurance bill and a $182 gas bill look very different side by
 * side until you notice the gas one arrives twelve times.
 */
export function RepeatingCosts({
  costs,
  categories,
  today,
}: {
  costs: RecurringCostRow[];
  categories: string[];
  today: string;
}) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    saveRecurringCost,
    null,
  );
  const [adding, setAdding] = useState(false);

  const live = costs.filter((c) => c.is_active);
  const yearTotal = live.reduce(
    (sum, c) => sum + yearlyCents(c.amount_cents, c.cadence),
    0,
  );

  return (
    <div>
      {live.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Nothing set up. Insurance, the gas, the water — anything that arrives
          on a schedule is worth putting here, so the forecast knows about it
          before the bill does.
        </p>
      ) : (
        live.map((cost) => <CostRow key={cost.id} cost={cost} today={today} />)
      )}

      {live.length > 0 && (
        <p className="border-b border-tan/20 bg-parchment/40 px-5 py-3 text-sm text-ink-soft">
          Together these come to{" "}
          <strong className="text-ink">{moneyExact(yearTotal)}</strong> a year.
        </p>
      )}

      <div className="px-5 py-4">
        {!adding ? (
          <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add something that repeats
          </Button>
        ) : (
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who it's to">
                <input name="vendor" required className={inputClass} />
              </Field>
              <Field label="What kind of cost">
                <input name="category" required list="repeat-categories" className={inputClass} />
                <datalist id="repeat-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="How much each time">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="How often">
                <select name="cadence" required className={inputClass}>
                  <option value="monthly">Every month</option>
                  <option value="quarterly">Every three months</option>
                  <option value="yearly">Once a year</option>
                </select>
              </Field>
              <Field label="Next one due">
                <input name="nextDue" type="date" required className={inputClass} />
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
    </div>
  );
}

function CostRow({ cost, today }: { cost: RecurringCostRow; today: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    const fd = new FormData();
    fd.set("id", cost.id);
    start(async () => setResult(await action(fd)));
  }

  const dueSoon = cost.next_due <= today;

  return (
    <div className="border-b border-tan/20 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{cost.vendor}</p>
          <p className="text-sm text-ink-soft">
            {moneyExact(cost.amount_cents)} {CADENCE_LABEL[cost.cadence]} ·{" "}
            {cost.category}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Next {dateShort(cost.next_due)}
            {dueSoon ? " — due now" : ""} ·{" "}
            {moneyExact(yearlyCents(cost.amount_cents, cost.cadence))} a year
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={dueSoon ? "primary" : "ghost"}
          type="button"
          disabled={pending}
          onClick={() => run(raiseFromRecurring)}
        >
          <Repeat className="h-3.5 w-3.5" aria-hidden />
          Add the next one to what I owe
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          disabled={pending}
          onClick={() => run(stopRecurringCost)}
        >
          <StopCircle className="h-3.5 w-3.5" aria-hidden />
          Stop it
        </Button>
      </div>

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
