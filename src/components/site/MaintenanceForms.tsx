"use client";

import { useActionState, useEffect, useState } from "react";
import { Camera, CheckCircle2, Pencil, Trash2, Wrench } from "lucide-react";
import {
  renterMarksFixed,
  reportIssue,
  updateIssue,
  withdrawIssue,
} from "@/app/(site)/portal/maintenance-actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MaintenanceRequestRow, Urgency2 } from "@/lib/data/types";

const URGENCY: { value: Urgency2; label: string; hint: string }[] = [
  { value: "whenever", label: "Whenever suits", hint: "Annoying, not a problem" },
  { value: "normal", label: "Soon-ish", hint: "Should be looked at" },
  { value: "urgent", label: "Urgent", hint: "Water, heat, safety or security" },
];

const STATUS_WORDS: Record<MaintenanceRequestRow["status"], string> = {
  new: "Sent",
  seen: "Tausha's seen it",
  doing: "Being sorted",
  fixed: "Fixed",
  declined: "Not going ahead",
};

const STATUS_TONE: Record<
  MaintenanceRequestRow["status"],
  "neutral" | "warn" | "info" | "good" | "bad"
> = {
  new: "warn",
  seen: "info",
  doing: "info",
  fixed: "good",
  declined: "neutral",
};

/* ------------------------------ Reporting --------------------------------- */

export function ReportIssueForm() {
  const [result, action] = useActionState(reportIssue, null);
  const [open, setOpen] = useState(false);
  const [urgency, setUrgency] = useState<Urgency2>("normal");

  useEffect(() => {
    if (result?.ok) setOpen(false);
  }, [result]);

  if (!open) {
    return (
      <div className="space-y-3">
        <Button type="button" onClick={() => setOpen(true)}>
          <Wrench className="h-4 w-4" aria-hidden />
          Report something
        </Button>
        {result?.ok && <Feedback result={result} />}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <Field label="What's wrong">
        <input
          name="title"
          required
          placeholder="Kitchen tap drips overnight"
          className={inputClass}
        />
      </Field>

      <Field
        label="Anything else worth knowing"
        hint="When it happens, what you've tried, where exactly it is."
      >
        <textarea name="detail" rows={3} className={`${inputClass} resize-y`} />
      </Field>

      <fieldset>
        <legend className="eyebrow !text-[0.6rem] text-bark">
          How pressing is it
        </legend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {URGENCY.map((u) => (
            <label
              key={u.value}
              className={cn(
                "cursor-pointer rounded-[var(--radius-card)] border p-3.5 transition-colors",
                urgency === u.value
                  ? "border-olive bg-sage-pale/50"
                  : "border-tan/30 hover:border-olive/40",
              )}
            >
              <input
                type="radio"
                name="urgency"
                value={u.value}
                className="sr-only"
                checked={urgency === u.value}
                onChange={() => setUrgency(u.value)}
              />
              <span className="block text-sm font-medium text-ink">{u.label}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">{u.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="A photo, if it helps"
        hint="Optional. It often saves a trip to come and look."
      >
        <input
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sage-pale file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-wide file:text-olive-deep"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          <Camera className="h-3.5 w-3.5" aria-hidden />
          Send it
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/* ------------------------- One of her own reports -------------------------- */

export function MyRequest({
  request,
  unitName,
  photoUrl,
}: {
  request: MaintenanceRequestRow;
  unitName: string | null;
  photoUrl: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [editResult, editAction] = useActionState(updateIssue, null);
  const [, deleteAction] = useActionState(withdrawIssue, null);
  const [fixedResult, fixedAction] = useActionState(renterMarksFixed, null);

  useEffect(() => {
    if (editResult?.ok) setEditing(false);
  }, [editResult]);

  const canChange = request.status === "new" || request.status === "seen";
  const isFixed = request.status === "fixed";

  return (
    <li className={cn("px-5 py-4", isFixed && "bg-sage-pale/20")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("font-medium", isFixed ? "text-ink-faint" : "text-ink")}>
            {request.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {unitName && `${unitName} · `}
            Reported {dateShort(request.created_at)}
            {request.urgency === "urgent" && " · you marked this urgent"}
          </p>
          {request.detail && !editing && (
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {request.detail}
            </p>
          )}
        </div>

        <Badge tone={STATUS_TONE[request.status]}>
          {STATUS_WORDS[request.status]}
        </Badge>
      </div>

      {photoUrl && !editing && (
        <a
          href={photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="The photo sent with this report"
            className="max-h-44 rounded-[var(--radius-card)] border border-tan/30"
          />
        </a>
      )}

      {request.reply_to_renter && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-cream px-4 py-3 text-sm text-ink">
          <span className="eyebrow !text-[0.55rem] block text-bark">
            From Tausha
          </span>
          <span className="mt-1 block">{request.reply_to_renter}</span>
        </p>
      )}

      {editing ? (
        <form action={editAction} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={request.id} />
          <Field label="What's wrong">
            <input
              name="title"
              required
              defaultValue={request.title}
              className={inputClass}
            />
          </Field>
          <Field label="Anything else">
            <textarea
              name="detail"
              rows={3}
              defaultValue={request.detail ?? ""}
              className={`${inputClass} resize-y`}
            />
          </Field>
          <Field label="How pressing">
            <select
              name="urgency"
              defaultValue={request.urgency}
              className={inputClass}
            >
              {URGENCY.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Save</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Feedback result={editResult} />
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isFixed && (
            <form action={fixedAction}>
              <input type="hidden" name="id" value={request.id} />
              <Button size="sm" variant="secondary" type="submit">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                It's sorted now
              </Button>
            </form>
          )}

          {canChange && (
            <>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Change it
              </Button>

              {confirmingDelete ? (
                <form action={deleteAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={request.id} />
                  <span className="text-xs text-burgundy">Withdraw this?</span>
                  <SubmitButton>Yes</SubmitButton>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    No
                  </Button>
                </form>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Withdraw
                </Button>
              )}
            </>
          )}

          <Feedback result={fixedResult} />
        </div>
      )}

      {isFixed && request.fixed_at && (
        <p className="mt-2 text-xs text-ink-faint">
          Marked fixed {dateShort(request.fixed_at)}
          {request.fixed_by === "renter" ? " by you" : " by Tausha"}
        </p>
      )}
    </li>
  );
}
