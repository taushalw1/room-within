"use client";

import { useActionState, useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
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
