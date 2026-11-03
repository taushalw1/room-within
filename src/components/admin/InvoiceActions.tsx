"use client";

import { useActionState, useState } from "react";
import { BellRing, Check, HandCoins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  creditInvoice,
  recordPayment,
  sendReminderNow,
  type ActionResult,
} from "@/app/(admin)/admin/rentals/actions";
import { cn } from "@/lib/cn";

function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cn(
        "mt-2 text-xs",
        result.ok ? "text-olive" : "text-burgundy",
      )}
    >
      {result.message}
    </p>
  );
}

/** "Mark as paid" — opens a small inline form rather than a modal. */
export function RecordPaymentForm({
  invoiceId,
  contactId,
  balanceCents,
}: {
  invoiceId: string;
  contactId: string;
  balanceCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState(recordPayment, null);

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Check className="h-3.5 w-3.5" aria-hidden />
        Mark paid
      </Button>
    );
  }

  return (
    <form action={action} className="min-w-[16rem]">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="contactId" value={contactId} />

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow !text-[0.55rem] text-bark">Amount</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={(balanceCents / 100).toFixed(2)}
            className="w-24 rounded border border-tan/40 bg-cream px-2 py-1.5 text-sm tabular-nums"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="eyebrow !text-[0.55rem] text-bark">How</span>
          <select
            name="method"
            defaultValue="etransfer"
            className="rounded border border-tan/40 bg-cream px-2 py-1.5 text-sm"
          >
            <option value="etransfer">e-Transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="stripe">Card</option>
            <option value="other">Other</option>
          </select>
        </label>

        <Button size="sm" type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            "Save"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      <Result result={result} />
    </form>
  );
}

/** Send the reminder email now instead of waiting for the nightly run. */
export function SendReminderButton({ invoiceId }: { invoiceId: string }) {
  const [result, action, pending] = useActionState(sendReminderNow, null);

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button size="sm" variant="ghost" type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <BellRing className="h-3.5 w-3.5" aria-hidden />
        )}
        Remind
      </Button>
      <Result result={result} />
    </form>
  );
}

/**
 * Take part of an invoice off.
 *
 * Deliberately alongside "mark paid" rather than hidden somewhere tidier: the
 * moment she needs it is the moment she is looking at an invoice that is not
 * going to be paid in full, and that is this row.
 *
 * The reason is required by the form as well as by the server. A balance that
 * dropped with no explanation reads as a mistake a year later, and she is the
 * person who will have to explain it.
 */
export function CreditInvoiceForm({
  invoiceId,
  balanceCents,
}: {
  invoiceId: string;
  balanceCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState(creditInvoice, null);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <HandCoins className="h-3.5 w-3.5" aria-hidden />
        Take some off
      </Button>
    );
  }

  return (
    <form action={action} className="min-w-[18rem]">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow !text-[0.55rem] text-bark">How much off</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={(balanceCents / 100).toFixed(2)}
            required
            className="w-24 rounded border border-tan/40 bg-cream px-2 py-1.5 text-sm tabular-nums"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="eyebrow !text-[0.55rem] text-bark">Why</span>
          <input
            name="reason"
            required
            minLength={3}
            placeholder="No heat for a week"
            className="w-full rounded border border-tan/40 bg-cream px-2 py-1.5 text-sm"
          />
        </label>

        <Button size="sm" type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            "Save"
          )}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      <p className="mt-1.5 text-xs text-ink-faint">
        This reduces what they owe and keeps your reason with it. It is not a
        payment, and it will not show as money received.
      </p>

      <Result result={result} />
    </form>
  );
}
