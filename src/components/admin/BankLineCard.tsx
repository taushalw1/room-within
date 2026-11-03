"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  CircleHelp,
  CornerUpLeft,
  Plus,
  X,
} from "lucide-react";
import {
  addLineAsExpense,
  ignoreLine,
  matchLine,
  reopenLine,
  type ActionResult,
} from "@/app/(admin)/admin/bank/actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import { inputClass } from "@/components/ui/Form";
import { dateShort, money, moneyExact } from "@/lib/format";
import type { LineResult } from "@/lib/reconcile";
import type { BankLineRow } from "@/lib/data/types";

/**
 * One line of a statement, and what to do about it.
 *
 * The four states it can be in are drawn differently on purpose. A line with
 * one obvious answer is a single button, because that is the common case and
 * she will do it fifty times in a row. A line with several possible answers
 * refuses to pick one. A near miss shows the gap in money rather than making
 * her work it out. An unexplained line offers to record it, and asks for a
 * category — the one thing the statement cannot tell us.
 */
export function BankLineCard({
  line,
  proposal,
  categories,
}: {
  line: BankLineRow;
  /** Null for a line already decided. */
  proposal: LineResult | null;
  categories: string[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"none" | "ignore" | "expense">("none");

  const incoming = line.amount_cents > 0;

  function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData) {
    start(async () => setResult(await action(fd)));
  }

  function fd(extra: Record<string, string>) {
    const form = new FormData();
    form.set("lineId", line.id);
    for (const [k, v] of Object.entries(extra)) form.set(k, v);
    return form;
  }

  const decided = line.status !== "open";

  return (
    <div
      className={`border-b border-tan/20 px-5 py-4 ${decided ? "bg-sage-pale/20" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-body text-[0.95rem] text-ink">
              {line.description || <span className="text-ink-faint">No details given</span>}
            </p>
            <StatusBadge status={line.status} />
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {dateShort(line.occurred_on)} · row {line.line_no}
          </p>
          {line.note && (
            <p className="mt-1.5 text-xs italic text-ink-soft">{line.note}</p>
          )}
        </div>

        <p
          className={`shrink-0 font-display text-lg font-semibold ${
            incoming ? "text-olive-deep" : "text-burgundy"
          }`}
        >
          {incoming ? "+" : "−"}
          {moneyExact(Math.abs(line.amount_cents))}
        </p>
      </div>

      {/* ---------- Already decided ---------- */}
      {decided && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={pending}
            onClick={() => run(reopenLine, fd({}))}
          >
            <CornerUpLeft className="h-3.5 w-3.5" aria-hidden />
            Undo
          </Button>
        </div>
      )}

      {/* ---------- One obvious answer ---------- */}
      {!decided && proposal?.verdict === "one" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                matchLine,
                fd({
                  kind: proposal.candidates[0].entry.kind,
                  entryId: proposal.candidates[0].entry.id,
                }),
              )
            }
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Yes — {proposal.candidates[0].entry.label}
          </Button>
          <GapNote candidate={proposal.candidates[0]} />
          <OtherOptions onIgnore={() => setPanel("ignore")} />
        </div>
      )}

      {/* ---------- More than one answer ---------- */}
      {!decided && proposal?.verdict === "several" && (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-bark">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden />
            More than one thing this could be — which was it?
          </p>
          <div className="flex flex-wrap gap-2">
            {proposal.candidates.map((c) => (
              <Button
                key={`${c.entry.kind}-${c.entry.id}`}
                size="sm"
                variant="ghost"
                type="button"
                disabled={pending}
                onClick={() =>
                  run(matchLine, fd({ kind: c.entry.kind, entryId: c.entry.id }))
                }
              >
                {c.entry.label}
                <span className="text-ink-faint">· {dateShort(c.entry.date)}</span>
              </Button>
            ))}
          </div>
          <OtherOptions onIgnore={() => setPanel("ignore")} />
        </div>
      )}

      {/* ---------- Close, but not exact ---------- */}
      {!decided && proposal?.verdict === "near" && (
        <div className="mt-3 space-y-2">
          <p className="flex items-start gap-1.5 text-xs text-bark">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Nothing matches this exactly. These are close — the difference is
            usually a fee.
          </p>
          <div className="space-y-1.5">
            {proposal.candidates.map((c) => (
              <div
                key={`${c.entry.kind}-${c.entry.id}`}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(matchLine, fd({ kind: c.entry.kind, entryId: c.entry.id }))
                  }
                >
                  {c.entry.label}
                </Button>
                <span className="text-xs text-ink-faint">
                  {dateShort(c.entry.date)} ·{" "}
                  <strong className="text-burgundy">
                    {money(Math.abs(c.centGap))} {c.centGap < 0 ? "short" : "over"}
                  </strong>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {!incoming && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setPanel("expense")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Record it as a new cost
              </Button>
            )}
            <OtherOptions onIgnore={() => setPanel("ignore")} />
          </div>
        </div>
      )}

      {/* ---------- Never seen it before ---------- */}
      {!decided && proposal?.verdict === "none" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-bark">
            {incoming
              ? "No payment on your books matches this. Worth finding out who sent it."
              : "Nothing on your books matches this. A direct debit, perhaps, or a cost not entered yet."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!incoming && (
              <Button
                size="sm"
                type="button"
                onClick={() => setPanel("expense")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Record it as a cost
              </Button>
            )}
            <OtherOptions onIgnore={() => setPanel("ignore")} />
          </div>
        </div>
      )}

      {/* ---------- Set it aside ---------- */}
      {panel === "ignore" && (
        <form
          className="mt-3 space-y-2 rounded-[var(--radius-card)] bg-parchment/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const note = new FormData(e.currentTarget).get("note");
            run(ignoreLine, fd({ note: String(note ?? "") }));
          }}
        >
          <label className="block">
            <span className="eyebrow !text-[0.6rem] text-bark">
              Why is this not a cost or a payment?
            </span>
            <input
              name="note"
              required
              minLength={3}
              placeholder="Bank charge, transfer between my own accounts…"
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              Set it aside
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setPanel("none")}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* ---------- Record it as a cost ---------- */}
      {panel === "expense" && (
        <form
          className="mt-3 space-y-2 rounded-[var(--radius-card)] bg-parchment/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            run(
              addLineAsExpense,
              fd({
                category: String(form.get("category") ?? ""),
                vendor: String(form.get("vendor") ?? ""),
              }),
            );
          }}
        >
          <p className="text-xs text-ink-soft">
            {moneyExact(Math.abs(line.amount_cents))} on{" "}
            {dateShort(line.occurred_on)}, taken from the statement.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow !text-[0.6rem] text-bark">What kind of cost</span>
              <input
                name="category"
                required
                list="bank-expense-categories"
                placeholder="Utilities"
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block">
              <span className="eyebrow !text-[0.6rem] text-bark">Who it went to</span>
              <input
                name="vendor"
                defaultValue={tidyVendor(line.description)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
          </div>
          <datalist id="bank-expense-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              Record it
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setPanel("none")}
            >
              Cancel
            </Button>
          </div>
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

/** Says how far off the date was, but only when it is far enough to notice. */
function GapNote({ candidate }: { candidate: { dayGap: number } }) {
  const gap = Math.abs(candidate.dayGap);
  if (gap < 2) return null;
  return (
    <span className="text-xs text-ink-faint">
      cleared {gap} days {candidate.dayGap > 0 ? "later" : "earlier"}
    </span>
  );
}

function OtherOptions({ onIgnore }: { onIgnore: () => void }) {
  return (
    <Button size="sm" variant="ghost" type="button" onClick={onIgnore}>
      <X className="h-3.5 w-3.5" aria-hidden />
      It&rsquo;s neither
    </Button>
  );
}

function StatusBadge({ status }: { status: BankLineRow["status"] }) {
  if (status === "open") return null;
  const label =
    status === "matched" ? "ticked off" : status === "added" ? "recorded" : "set aside";
  return <Badge tone={status === "ignored" ? "neutral" : "good"}>{label}</Badge>;
}

/**
 * A bank description, made presentable as a payee.
 *
 * Only a starting point — it is put in an editable field, not saved as it
 * stands. Reference numbers and the bank's own verbs are what she would delete
 * by hand every time otherwise.
 */
function tidyVendor(description: string): string {
  return description
    .replace(/\b(pre-?auth(orised|orized)?|debit|credit|memo|pos|purchase|payment|transfer|e-?transfer|withdrawal|deposit|bill|online|banking)\b/gi, " ")
    .replace(/\b[a-z]{0,3}\d{4,}\b/gi, " ")
    .replace(/[^A-Za-z0-9&'. -]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 60);
}
