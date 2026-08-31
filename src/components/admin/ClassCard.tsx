"use client";

import { useActionState, useCallback, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  addEnrolment,
  addSessions,
  cancelSession,
  deleteClass,
  recordAttendance,
  removeEnrolment,
} from "@/app/(admin)/admin/classes/actions";
import { ClassForm } from "@/components/admin/ClassForm";
import { Badge, Card, CardHeader } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateTimeRange, money, moneyExact } from "@/lib/format";
import { TIER_LABELS } from "@/lib/classes";
import type {
  ClassRow,
  ClassSessionRow,
  EnrolmentRow,
  InstructorRow,
  MembershipRow,
  RoomRow,
} from "@/lib/data/types";
import type { SessionMoney } from "@/lib/classes";

export type SessionView = {
  session: ClassSessionRow;
  enrolments: EnrolmentRow[];
  money: SessionMoney;
};

const STATUS_TONE = {
  scheduled: "warn",
  confirmed: "good",
  delivered: "info",
  cancelled: "bad",
} as const;

const STATUS_WORD = {
  scheduled: "waiting on numbers",
  confirmed: "going ahead",
  delivered: "taught",
  cancelled: "cancelled",
} as const;

export function ClassCard({
  klass,
  instructor,
  room,
  sessions,
  instructors,
  rooms,
  memberships,
}: {
  klass: ClassRow;
  instructor: InstructorRow | null;
  room: RoomRow | null;
  sessions: SessionView[];
  instructors: InstructorRow[];
  rooms: RoomRow[];
  memberships: MembershipRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  const upcoming = sessions.filter(
    (s) => s.session.status !== "delivered" && s.session.status !== "cancelled",
  );

  return (
    <Card>
      <CardHeader
        title={klass.title}
        description={
          [
            instructor?.display_name ?? "No instructor yet",
            room?.name,
            `${klass.session_minutes} min`,
            `up to ${klass.capacity}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={klass.status === "open" ? "good" : "neutral"}>
              {klass.status}
            </Badge>
            {!klass.is_public && <Badge tone="neutral">not listed</Badge>}
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {editing ? "Close" : "Edit"}
            </Button>
          </div>
        }
      />

      {editing ? (
        <div className="border-b border-tan/20 bg-sage-pale/20 p-5">
          <ClassForm
            klass={klass}
            instructors={instructors}
            rooms={rooms}
            onSaved={stopEditing}
            onCancel={stopEditing}
          />
          <div className="mt-6 border-t border-tan/20 pt-4">
            <DeleteClass klass={klass} />
          </div>
        </div>
      ) : null}

      {/* ---- Prices at a glance ---- */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-tan/20 px-5 py-4 text-sm">
        <Price label="Full" cents={klass.full_price_cents} />
        <Price label="Reduced" cents={klass.reduced_price_cents} />
        <Price label="Subsidized" cents={klass.subsidized_price_cents} />
        <Price
          label="Or credits"
          text={`${klass.credit_cost} ${klass.credit_cost === 1 ? "credit" : "credits"}`}
        />
        {klass.materials_cost_cents > 0 && (
          <Price
            label="Materials (private)"
            cents={klass.materials_cost_cents}
            muted
          />
        )}
      </div>

      {/* ---- Sessions ---- */}
      <div className="divide-y divide-tan/20">
        {upcoming.length === 0 && !open ? (
          <p className="px-5 py-6 text-sm text-ink-faint">
            No sessions scheduled.
          </p>
        ) : (
          (open ? sessions : upcoming).map((view) => (
            <SessionRow
              key={view.session.id}
              klass={klass}
              view={view}
              memberships={memberships}
            />
          ))
        )}
      </div>

      {sessions.length > upcoming.length && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-tan/20 px-5 py-3 text-xs text-ink-soft transition-colors hover:bg-parchment/50"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          {open
            ? "Hide finished sessions"
            : `Show all ${sessions.length} sessions`}
        </button>
      )}

      <div className="border-t border-tan/20 bg-parchment/40 p-5">
        <AddSessions klass={klass} />
      </div>
    </Card>
  );
}

function Price({
  label,
  cents,
  text,
  muted,
}: {
  label: string;
  cents?: number;
  text?: string;
  muted?: boolean;
}) {
  return (
    <span className={muted ? "text-ink-faint" : undefined}>
      <span className="eyebrow !text-[0.55rem] text-bark">{label}</span>
      <span className="mt-0.5 block font-medium">
        {text ?? (cents != null ? moneyExact(cents) : "—")}
      </span>
    </span>
  );
}

/* ------------------------------- One session ------------------------------ */

function SessionRow({
  klass,
  view,
  memberships,
}: {
  klass: ClassRow;
  view: SessionView;
  memberships: MembershipRow[];
}) {
  const [showList, setShowList] = useState(false);
  const { session, enrolments, money: m } = view;
  const live = enrolments.filter((e) => !e.cancelled_at);
  const short = klass.min_headcount - live.length;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {dateTimeRange(session.starts_at, session.ends_at)}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {live.length} of {klass.capacity} signed up
            {m.subsidizedSeats > 0 && ` · ${m.subsidizedSeats} subsidized`}
            {session.status !== "delivered" && short > 0 && (
              <span className="text-burgundy">
                {" "}
                · needs {short} more to run
              </span>
            )}
          </p>
          {m.overSubsidyCap && (
            <p className="mt-1 text-xs text-burgundy">
              More subsidized seats than the {klass.subsidized_seat_cap} you
              capped it at — the scholarship fund covers the difference.
            </p>
          )}
          {session.cancel_reason && (
            <p className="mt-1 text-xs text-ink-faint">
              {session.cancel_reason}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[session.status]}>
            {STATUS_WORD[session.status]}
          </Badge>
          <span className="text-sm text-ink-soft">
            {money(m.splittableCents)} in · {money(m.instructorCents)} to them
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setShowList((v) => !v)}
            >
              {showList ? "Hide" : "Who's coming"}
            </Button>
            {session.status !== "cancelled" &&
              session.status !== "delivered" && <CancelSession session={session} />}
          </div>
        </div>
      </div>

      {showList && (
        <div className="mt-4 rounded-[var(--radius-card)] bg-parchment/60 p-4">
          {session.status === "delivered" ? (
            <AttendanceList enrolments={live} />
          ) : (
            <AttendanceForm session={session} enrolments={live} />
          )}

          <div className="mt-5 border-t border-tan/25 pt-4">
            <AddAttendee
              klass={klass}
              session={session}
              memberships={memberships}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceList({ enrolments }: { enrolments: EnrolmentRow[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {enrolments.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-4">
          <span className={e.attended === false ? "text-ink-faint line-through" : ""}>
            {e.attendee_name}
          </span>
          <span className="text-xs text-ink-faint">
            {TIER_LABELS[e.tier]} ·{" "}
            {e.method === "credit"
              ? `${e.credits_spent} credit${e.credits_spent === 1 ? "" : "s"}`
              : moneyExact(e.paid_cents)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AttendanceForm({
  session,
  enrolments,
}: {
  session: ClassSessionRow;
  enrolments: EnrolmentRow[];
}) {
  const [result, action] = useActionState(recordAttendance, null);

  if (enrolments.length === 0) {
    return <p className="text-sm text-ink-faint">Nobody signed up yet.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sessionId" value={session.id} />
      <p className="eyebrow !text-[0.6rem] text-bark">Who came</p>

      <ul className="space-y-2">
        {enrolments.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name={`attended:${e.id}`}
                defaultChecked={e.attended !== false}
                className="h-4 w-4 accent-[var(--color-olive)]"
              />
              {e.attendee_name}
            </label>
            <span className="flex items-center gap-3 text-xs text-ink-faint">
              {TIER_LABELS[e.tier]} ·{" "}
              {e.method === "credit"
                ? `${e.credits_spent} credit${e.credits_spent === 1 ? "" : "s"}`
                : moneyExact(e.paid_cents)}
              <RemoveAttendee enrolmentId={e.id} />
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton>Save the register</SubmitButton>
        <Feedback result={result} />
      </div>
      <p className="text-xs text-ink-faint">
        Saving marks the session taught, which is what puts the money on the
        instructor&rsquo;s statement.
      </p>
    </form>
  );
}

function RemoveAttendee({ enrolmentId }: { enrolmentId: string }) {
  const [, action] = useActionState(removeEnrolment, null);
  return (
    <form action={action}>
      <input type="hidden" name="enrolmentId" value={enrolmentId} />
      <button
        type="submit"
        className="text-ink-faint transition-colors hover:text-burgundy"
        aria-label="Take off the list"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </form>
  );
}

function AddAttendee({
  klass,
  session,
  memberships,
}: {
  klass: ClassRow;
  session: ClassSessionRow;
  memberships: MembershipRow[];
}) {
  const [result, action] = useActionState(addEnrolment, null);
  const [method, setMethod] = useState<"cash" | "credit">("cash");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sessionId" value={session.id} />
      <p className="eyebrow !text-[0.6rem] text-bark">Add someone by hand</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input name="attendeeName" required className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="attendeeEmail" type="email" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price they pay">
          <select name="tier" className={inputClass}>
            <option value="full">Full — {moneyExact(klass.full_price_cents)}</option>
            <option value="reduced">
              Reduced — {moneyExact(klass.reduced_price_cents)}
            </option>
            <option value="subsidized">
              Subsidized — {moneyExact(klass.subsidized_price_cents)}
            </option>
          </select>
        </Field>
        <Field label="How">
          <select
            name="method"
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value as "cash" | "credit")}
          >
            <option value="cash">Cash or card</option>
            <option value="credit">Membership credits</option>
          </select>
        </Field>
        {method === "credit" && (
          <Field label="Whose credits">
            <select name="membershipId" className={inputClass}>
              <option value="">Choose…</option>
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.household_name ?? m.contact_id}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          Add them
        </SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/* ------------------------------- Scheduling ------------------------------- */

function AddSessions({ klass }: { klass: ClassRow }) {
  const [result, action] = useActionState(addSessions, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="classId" value={klass.id} />
      <p className="eyebrow !text-[0.6rem] text-bark">Schedule sessions</p>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="First one">
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className={inputClass}
          />
        </Field>
        <Field label="Starting at">
          <input
            name="startTime"
            type="time"
            step={900}
            required
            defaultValue="18:00"
            className={inputClass}
          />
        </Field>
        <Field label="How many weeks" hint="Same day and time each week.">
          <input
            name="repeatWeeks"
            type="number"
            min="1"
            max="52"
            defaultValue="8"
            className={inputClass}
          />
        </Field>
        <div className="flex items-end">
          <SubmitButton>
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Add them
          </SubmitButton>
        </div>
      </div>

      <Feedback result={result} />
    </form>
  );
}

function CancelSession({ session }: { session: ClassSessionRow }) {
  const [result, action] = useActionState(cancelSession, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => setConfirming(true)}
      >
        Cancel
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="sessionId" value={session.id} />
      <input
        name="reason"
        placeholder="Why? (optional)"
        className="w-40 rounded border border-tan/40 bg-cream px-2 py-1 text-xs"
      />
      <SubmitButton>Cancel it</SubmitButton>
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => setConfirming(false)}
      >
        Keep it
      </Button>
      <Feedback result={result} />
    </form>
  );
}

function DeleteClass({ klass }: { klass: ClassRow }) {
  const [result, action] = useActionState(deleteClass, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete this class
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="classId" value={klass.id} />
      <p className="text-sm text-burgundy">
        This removes <strong>{klass.title}</strong>, every session of it, and
        every sign-up. It cannot be undone.
      </p>
      <div className="flex items-center gap-3">
        <SubmitButton>Yes, delete it</SubmitButton>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setConfirming(false)}
        >
          Keep it
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}
