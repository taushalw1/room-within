"use client";

import { useState, useTransition } from "react";
import { Trash2, Wand2 } from "lucide-react";
import {
  deleteBankRule,
  saveBankRule,
  type ActionResult,
} from "@/app/(admin)/admin/bank/actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import { inputClass } from "@/components/ui/Form";
import type { BankRuleRow } from "@/lib/data/types";

/**
 * The rules that file things without being asked.
 *
 * Mostly these get written from a statement line, by ticking "remember this".
 * This list exists so they can be seen and removed — a rule that fires
 * invisibly and cannot be found is how somebody ends up with a year of costs
 * in the wrong category and no idea why.
 *
 * How many times each has fired is shown, because a rule that has never fired
 * is usually a typo rather than a rule.
 */
export function BankRules({ rules }: { rules: BankRuleRow[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData) {
    start(async () => setResult(await action(fd)));
  }

  return (
    <div>
      {rules.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          No rules yet. When you file an unexplained line as a cost, tick
          &ldquo;remember this&rdquo; and it will appear here.
        </p>
      ) : (
        rules.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-tan/20 px-5 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink">
                Anything with{" "}
                <strong className="font-semibold">{rule.match_text}</strong> in it
                {rule.category ? (
                  <>
                    {" "}
                    &rarr; <strong>{rule.category}</strong>
                  </>
                ) : null}
              </p>
              <p className="text-xs text-ink-faint">
                {rule.direction === "out" ? "money going out" : "money coming in"}
                {rule.vendor ? ` · ${rule.vendor}` : ""} ·{" "}
                {rule.times_used === 0
                  ? "never used yet"
                  : `used ${rule.times_used} time${rule.times_used === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {rule.times_used === 0 && <Badge tone="neutral">unused</Badge>}
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove the rule for ${rule.match_text}`}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", rule.id);
                  run(deleteBankRule, fd);
                }}
                className="text-ink-faint hover:text-burgundy"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ))
      )}

      <div className="px-5 py-4">
        {!adding ? (
          <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(true)}>
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Write one by hand
          </Button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(saveBankRule, new FormData(e.currentTarget));
              setAdding(false);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow !text-[0.6rem] text-bark">
                  Words to look for
                </span>
                <input
                  name="matchText"
                  required
                  minLength={3}
                  placeholder="FORTIS ALBERTA"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="block">
                <span className="eyebrow !text-[0.6rem] text-bark">
                  Which way the money goes
                </span>
                <select name="direction" className={`${inputClass} mt-1.5`}>
                  <option value="out">Out — a cost</option>
                  <option value="in">In — money arriving</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow !text-[0.6rem] text-bark">File it as</span>
                <input name="category" placeholder="Utilities" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block">
                <span className="eyebrow !text-[0.6rem] text-bark">Who it is</span>
                <input name="vendor" className={`${inputClass} mt-1.5`} />
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={pending}>
                Save the rule
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`px-5 pb-4 text-sm ${result.ok ? "text-olive" : "text-burgundy"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
