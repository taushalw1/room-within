"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Check,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  addOpportunity,
  saveNotes,
  setArchived,
  setStatus,
  setVerified,
  toggleStep,
} from "@/app/(admin)/admin/grants/actions";
import { Badge, Td } from "@/components/ui/Table";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import {
  STATUS_LABELS,
  STATUS_TONES,
  amountRange,
  deadlineNote,
  urgencyOf,
} from "@/lib/opportunities";
import { dateShort, money, moneyExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  OpportunityKind,
  OpportunityRow,
  OpportunityStatus,
  OpportunityStepRow,
} from "@/lib/data/types";

const basePath = (kind: OpportunityKind) =>
  kind === "grant" ? "/admin/grants" : "/admin/conferences";

/* --------------------------------- A row ---------------------------------- */

export function OpportunityListRow({
  opportunity: o,
  progress,
}: {
  opportunity: OpportunityRow;
  progress?: { done: number; total: number };
}) {
  const href = `${basePath(o.kind)}/${o.id}`;
  const urgency = urgencyOf(o.kind === "grant" ? o.deadline : o.starts_on);

  return (
    <tr>
      <Td>
        <Link href={href} className="font-medium text-olive-deep hover:underline">
          {o.title}
        </Link>
        {o.organisation && (
          <span className="block text-xs text-ink-faint">{o.organisation}</span>
        )}
        {!o.verified_at && o.source === "search" && (
          <span className="mt-1 inline-block text-xs text-burgundy">
            Details not checked yet
          </span>
        )}
      </Td>

      {o.kind === "grant" ? (
        <Td align="right">
          {amountRange(o, money) ?? <span className="text-ink-faint">—</span>}
        </Td>
      ) : (
        <Td>
          {o.location ?? (o.is_online ? "Online" : "—")}
          {o.cost_cents != null && (
            <span className="block text-xs text-ink-faint">
              {moneyExact(o.cost_cents)}
            </span>
          )}
        </Td>
      )}

      <Td>
        <span
          className={cn(
            urgency === "urgent" && "text-burgundy",
            urgency === "passed" && "text-ink-faint line-through",
          )}
        >
          {o.kind === "grant"
            ? o.deadline
              ? dateShort(o.deadline)
              : o.deadline_note
                ? "Rolling"
                : "—"
            : o.starts_on
              ? dateShort(o.starts_on)
              : "—"}
        </span>
        <span className="block text-xs text-ink-faint">
          {o.kind === "grant"
            ? o.deadline
              ? deadlineNote(o.deadline)
              : (o.deadline_note ?? deadlineNote(null))
            : deadlineNote(o.starts_on)}
        </span>
      </Td>

      {o.kind === "grant" && (
        <Td align="right">
          {o.probability != null ? (
            <span className="text-sm">{o.probability}%</span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Td>
      )}

      <Td align="right">
        {progress && progress.total > 0 ? (
          <span className="text-sm">
            {progress.done}/{progress.total}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </Td>

      <Td align="right">
        <Badge tone={STATUS_TONES[o.status]}>{STATUS_LABELS[o.status]}</Badge>
      </Td>

      <Td align="right">
        <ButtonLink size="sm" variant="secondary" href={href}>
          Open
        </ButtonLink>
      </Td>
    </tr>
  );
}

/* ------------------------------ Status buttons ----------------------------- */

const CHOICES: { status: OpportunityStatus; label: string }[] = [
  { status: "interested", label: "Interested" },
  { status: "not_interested", label: "Not for us" },
  { status: "applied", label: "Applied" },
  { status: "awarded", label: "We got it" },
  { status: "rejected", label: "Turned down" },
];

export function StatusPicker({ opportunity }: { opportunity: OpportunityRow }) {
  const [result, action] = useActionState(setStatus, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={opportunity.id} />
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((c) => {
          const current = opportunity.status === c.status;
          return (
            <button
              key={c.status}
              type="submit"
              name="status"
              value={c.status}
              disabled={current}
              className={cn(
                "eyebrow rounded-full border px-3.5 py-1.5 !text-[0.58rem] transition-colors",
                current
                  ? "cursor-default border-olive bg-olive text-cream"
                  : "border-tan/40 bg-cream text-bark hover:border-olive/50 hover:bg-sage-pale/40",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <Feedback result={result} />
      {opportunity.status === "new" && (
        <p className="text-xs text-ink-faint">
          Marking it interested writes the step-by-step list below.
        </p>
      )}
    </form>
  );
}

/* -------------------------------- Checklist -------------------------------- */

export function Checklist({
  steps,
  kind,
}: {
  steps: OpportunityStepRow[];
  kind: OpportunityKind;
}) {
  if (steps.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-ink-faint">
        Mark this {kind === "grant" ? "grant" : "one"} as{" "}
        <strong>Interested</strong> above and the steps will appear here.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-tan/20">
      {steps.map((step) => (
        <StepItem key={step.id} step={step} />
      ))}
    </ol>
  );
}

function StepItem({ step }: { step: OpportunityStepRow }) {
  const [, action] = useActionState(toggleStep, null);
  const done = Boolean(step.done_at);

  return (
    <li className={cn("px-5 py-4", done && "bg-sage-pale/20")}>
      <form action={action} className="flex items-start gap-3.5">
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="done" value={done ? "false" : "true"} />

        <button
          type="submit"
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
            done
              ? "border-olive bg-olive text-cream"
              : "border-tan/50 bg-cream hover:border-olive",
          )}
        >
          {done && <Check className="h-3.5 w-3.5" aria-hidden />}
        </button>

        <div className="min-w-0">
          <p
            className={cn(
              "font-medium",
              done ? "text-ink-faint line-through" : "text-ink",
            )}
          >
            {step.position}. {step.title}
          </p>
          {step.detail && (
            <p
              className={cn(
                "mt-1 text-sm leading-relaxed",
                done ? "text-ink-faint" : "text-ink-soft",
              )}
            >
              {step.detail}
            </p>
          )}
          {done && step.done_at && (
            <p className="mt-1 text-xs text-ink-faint">
              Done {dateShort(step.done_at)}
            </p>
          )}
        </div>
      </form>
    </li>
  );
}

/* ------------------------- Archive, verify, notes -------------------------- */

export function ArchiveButton({ opportunity }: { opportunity: OpportunityRow }) {
  const [result, action] = useActionState(setArchived, null);
  const archived = Boolean(opportunity.archived_at);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={opportunity.id} />
      <input type="hidden" name="archive" value={archived ? "false" : "true"} />
      <Button size="sm" variant="ghost" type="submit">
        {archived ? (
          <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Archive className="h-3.5 w-3.5" aria-hidden />
        )}
        {archived ? "Bring it back" : "Put it away"}
      </Button>
      <Feedback result={result} />
    </form>
  );
}

export function VerifyButton({ opportunity }: { opportunity: OpportunityRow }) {
  const [result, action] = useActionState(setVerified, null);

  if (opportunity.verified_at) {
    return (
      <p className="flex items-center gap-2 text-sm text-olive">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Checked against their page on {dateShort(opportunity.verified_at)}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={opportunity.id} />
      <p className="text-sm leading-relaxed text-ink-soft">
        Everything below was read off the web automatically and{" "}
        <strong>hasn&rsquo;t been checked by anyone</strong>. Open their page,
        confirm the dates and the amounts, then say so here — the briefing
        document tells your assistant whether these figures can be trusted.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {opportunity.url && (
          <ButtonLink
            size="sm"
            variant="secondary"
            href={opportunity.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open their page
          </ButtonLink>
        )}
        <SubmitButton>I&rsquo;ve checked it</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function NotesBox({ opportunity }: { opportunity: OpportunityRow }) {
  const [result, action] = useActionState(saveNotes, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={opportunity.id} />
      <textarea
        name="notes"
        rows={4}
        defaultValue={opportunity.notes ?? ""}
        placeholder="Anything you want to remember — who you spoke to, what they said, what to do differently next time."
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save notes</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/* ------------------------------ Adding by hand ----------------------------- */

export function AddOpportunityForm({ kind }: { kind: OpportunityKind }) {
  const [result, action] = useActionState(addOpportunity, null);
  const isGrant = kind === "grant";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is it called">
          <input name="title" required className={inputClass} />
        </Field>
        <Field label={isGrant ? "Who gives the money" : "Who runs it"}>
          <input name="organisation" className={inputClass} />
        </Field>
      </div>

      <Field label="Link to their page" hint="Paste the address from your browser.">
        <input
          name="url"
          type="url"
          required
          placeholder="https://"
          className={inputClass}
        />
      </Field>

      <Field label="What it is">
        <textarea name="summary" rows={2} className={`${inputClass} resize-y`} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {isGrant ? (
          <>
            <Field label="Closing date">
              <input name="deadline" type="date" className={inputClass} />
            </Field>
            <Field label="Most they give">
              <input
                name="amountMax"
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Starts on">
              <input name="startsOn" type="date" className={inputClass} />
            </Field>
            <Field label="Registration cost">
              <input
                name="cost"
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </Field>
          </>
        )}
      </div>

      {isGrant && (
        <CheckField
          name="coversTravel"
          label="This one can pay for travel, training or conferences"
          hint="Ticking it makes this grant show up on conference pages."
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Add it</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
