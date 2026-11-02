"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Receipt, Wrench } from "lucide-react";
import {
  recordRepairCost,
  setMaintenanceStatus,
} from "@/app/(admin)/admin/maintenance/actions";
import { Badge } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { dateShort, moneyExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MaintenanceRequestRow, MaintenanceStatus } from "@/lib/data/types";

const STATUS_WORDS: Record<MaintenanceStatus, string> = {
  new: "New",
  seen: "Seen it",
  doing: "Working on it",
  fixed: "Fixed",
  declined: "Not going ahead",
};

const STATUS_TONE: Record<
  MaintenanceStatus,
  "neutral" | "warn" | "info" | "good" | "bad"
> = {
  new: "bad",
  seen: "warn",
  doing: "info",
  fixed: "good",
  declined: "neutral",
};

const URGENCY_TONE = {
  urgent: "bad",
  normal: "neutral",
  whenever: "neutral",
} as const;

export function MaintenanceItem({
  request,
  unitName,
  photoUrl,
  receiptUrl,
}: {
  request: MaintenanceRequestRow;
  unitName: string | null;
  photoUrl: string | null;
  receiptUrl: string | null;
}) {
  const [open, setOpen] = useState(request.status === "new");
  const [statusResult, statusAction] = useActionState(setMaintenanceStatus, null);
  const [costResult, costAction] = useActionState(recordRepairCost, null);

  const isFixed = request.status === "fixed";
  const needsCost = isFixed && request.cost_cents == null;

  return (
    <li
      className={cn(
        "border-b border-tan/20 last:border-b-0",
        request.status === "new" && "bg-blush/20",
        isFixed && "bg-sage-pale/20",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-parchment/40"
      >
        <div className="min-w-0">
          <p className="font-medium text-ink">{request.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {unitName && `${unitName} · `}
            {request.reported_by} · {dateShort(request.created_at)}
          </p>
          {needsCost && (
            <p className="mt-1.5 text-xs text-burgundy">
              Fixed — what did it cost?
            </p>
          )}
        </div>

        <span className="flex shrink-0 items-center gap-2">
          {request.urgency === "urgent" && !isFixed && (
            <Badge tone={URGENCY_TONE.urgent}>urgent</Badge>
          )}
          <Badge tone={STATUS_TONE[request.status]}>
            {STATUS_WORDS[request.status]}
          </Badge>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-ink-faint transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-tan/15 bg-parchment/30 px-5 py-5">
          {request.detail && (
            <p className="text-sm leading-relaxed text-ink-soft">{request.detail}</p>
          )}

          {photoUrl && (
            <a href={photoUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Photo sent with the report"
                className="max-h-64 rounded-[var(--radius-card)] border border-tan/30"
              />
            </a>
          )}

          {request.fixed_at && (
            <p className="text-xs text-ink-faint">
              Marked fixed {dateShort(request.fixed_at)}
              {request.fixed_by === "renter"
                ? " by the renter"
                : " by you"}
            </p>
          )}

          {/* ---- Where it's up to ---- */}
          <form action={statusAction} className="space-y-4">
            <input type="hidden" name="id" value={request.id} />

            <div className="flex flex-wrap gap-2">
              {(
                ["seen", "doing", "fixed", "declined"] as MaintenanceStatus[]
              ).map((s) => (
                <button
                  key={s}
                  type="submit"
                  name="status"
                  value={s}
                  disabled={request.status === s}
                  className={cn(
                    "eyebrow rounded-full border px-3.5 py-1.5 !text-[0.58rem] transition-colors",
                    request.status === s
                      ? "cursor-default border-olive bg-olive text-cream"
                      : "border-tan/40 bg-cream text-bark hover:border-olive/50 hover:bg-sage-pale/40",
                  )}
                >
                  {STATUS_WORDS[s]}
                </button>
              ))}
            </div>

            <Field
              label="A line for the renter"
              hint="They see this. Marking it fixed emails it to them."
            >
              <textarea
                name="replyToRenter"
                rows={2}
                defaultValue={request.reply_to_renter ?? ""}
                placeholder="Dale's coming Thursday morning."
                className={`${inputClass} resize-y`}
              />
            </Field>

            <Field label="Your own notes" hint="Just for you — they never see this.">
              <textarea
                name="adminNotes"
                rows={2}
                defaultValue={request.admin_notes ?? ""}
                className={`${inputClass} resize-y`}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>Save</SubmitButton>
              <Feedback result={statusResult} />
            </div>
          </form>

          {/* ---- What it cost ---- */}
          {isFixed && (
            <form
              action={costAction}
              className={cn(
                "space-y-4 rounded-[var(--radius-card)] p-4",
                needsCost ? "bg-blush/40" : "bg-cream",
              )}
            >
              <input type="hidden" name="id" value={request.id} />

              <p className="eyebrow !text-[0.6rem] text-bark">
                <Receipt className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                What did it cost?
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount" hint="Put 0 if it cost nothing.">
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={
                      request.cost_cents != null
                        ? (request.cost_cents / 100).toFixed(2)
                        : ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="What was done">
                  <input
                    name="note"
                    defaultValue={request.cost_note ?? ""}
                    placeholder="New washer and a call-out."
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field
                label="The receipt"
                hint="A photo of it is fine. Kept for your records."
              >
                <input
                  name="receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sage-pale file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-wide file:text-olive-deep"
                />
              </Field>

              {receiptUrl && (
                <p className="text-xs">
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-burgundy underline"
                  >
                    The receipt already on file
                  </a>
                </p>
              )}

              {!request.expense_id && (
                <CheckField
                  name="alsoRecord"
                  label="Put this in the expenses book too"
                  defaultChecked
                  hint="Saves entering it twice. It goes in under repairs."
                />
              )}

              {request.expense_id && (
                <p className="text-xs text-ink-faint">
                  Already in the expenses book — it won&rsquo;t be added again.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton>
                  <Wrench className="h-3.5 w-3.5" aria-hidden />
                  Save the cost
                </SubmitButton>
                <Feedback result={costResult} />
              </div>
            </form>
          )}

          {request.cost_cents != null && (
            <p className="text-sm text-ink-soft">
              Cost: <strong>{moneyExact(request.cost_cents)}</strong>
              {request.cost_note && ` — ${request.cost_note}`}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
