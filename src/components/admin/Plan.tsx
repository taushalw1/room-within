"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ChevronDown, Lock, ShieldCheck } from "lucide-react";
import {
  saveGateNotes,
  saveTaskNotes,
  setGateStatus,
  setTaskStatus,
} from "@/app/(admin)/admin/plan/actions";
import { Badge } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Feedback, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  GateStatus,
  ProjectGateRow,
  ProjectTaskRow,
  ProjectTaskStatus,
  TaskPriority,
} from "@/lib/data/types";

/* --------------------------------- Gates ---------------------------------- */

const GATE_WORDS: Record<GateStatus, string> = {
  not_started: "Not started",
  in_progress: "Working on it",
  passed: "Passed",
};

const GATE_TONE: Record<GateStatus, "neutral" | "warn" | "good"> = {
  not_started: "neutral",
  in_progress: "warn",
  passed: "good",
};

/**
 * One phase gate.
 *
 * The conditions are listed as separate lines rather than one paragraph,
 * because they are meant to be read as a checklist before a decision that
 * commits real money. Passing one asks for a confirmation — the whole purpose
 * of writing gates down is that skipping one should be a deliberate act.
 */
export function Gate({
  gate,
  overdue,
}: {
  gate: ProjectGateRow;
  overdue: boolean;
}) {
  const [open, setOpen] = useState(gate.status === "in_progress");
  const [confirming, setConfirming] = useState(false);
  const [result, action] = useActionState(setGateStatus, null);

  const conditions = gate.conditions
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div
      className={cn(
        "border-b border-tan/20 last:border-b-0",
        gate.status === "passed" && "bg-sage-pale/20",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-parchment/40"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5">
            <span className="eyebrow !text-[0.58rem] text-bark">
              Gate {gate.position}
            </span>
            <span className="font-medium text-ink">{gate.decision}</span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {gate.owner}
            {gate.target_on && ` · target ${dateShort(gate.target_on)}`}
            {gate.passed_on && ` · passed ${dateShort(gate.passed_on)}`}
          </p>
          {overdue && gate.status !== "passed" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-burgundy">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Target date has gone by
            </p>
          )}
        </div>

        <span className="flex shrink-0 items-center gap-2">
          <Badge tone={GATE_TONE[gate.status]}>{GATE_WORDS[gate.status]}</Badge>
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
          <div>
            <p className="eyebrow !text-[0.6rem] text-bark">
              All of these must be true first
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {conditions.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {gate.risk_if_skipped && (
            <p className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-sm text-burgundy">
              <strong>If this gate is skipped:</strong> {gate.risk_if_skipped}
            </p>
          )}

          {gate.evidence && (
            <p className="text-xs text-ink-faint">
              Evidence lives in: {gate.evidence}
            </p>
          )}

          <form action={action} className="space-y-3">
            <input type="hidden" name="id" value={gate.id} />

            {confirming ? (
              <div className="space-y-2.5 rounded-[var(--radius-card)] border border-burgundy/30 bg-blush/30 p-4">
                <p className="text-sm text-ink">
                  Passing this gate says every condition above is genuinely
                  true. Is it?
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="submit"
                    name="status"
                    value="passed"
                    className="eyebrow rounded-full bg-olive px-3.5 py-1.5 !text-[0.58rem] text-cream"
                  >
                    Yes, pass it
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setConfirming(false)}
                  >
                    Not yet
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {gate.status !== "in_progress" && (
                  <button
                    type="submit"
                    name="status"
                    value="in_progress"
                    className="eyebrow rounded-full border border-tan/40 bg-cream px-3.5 py-1.5 !text-[0.58rem] text-bark transition-colors hover:border-olive/50"
                  >
                    Working on it
                  </button>
                )}
                {gate.status !== "passed" && (
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => setConfirming(true)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Pass this gate
                  </Button>
                )}
                {gate.status === "passed" && (
                  <button
                    type="submit"
                    name="status"
                    value="in_progress"
                    className="eyebrow rounded-full border border-tan/40 bg-cream px-3.5 py-1.5 !text-[0.58rem] text-bark"
                  >
                    Reopen it
                  </button>
                )}
              </div>
            )}

            <Feedback result={result} />
          </form>

          <GateNotes gate={gate} />
        </div>
      )}
    </div>
  );
}

function GateNotes({ gate }: { gate: ProjectGateRow }) {
  const [result, action] = useActionState(saveGateNotes, null);

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="id" value={gate.id} />
      <label className="eyebrow !text-[0.6rem] block text-bark">
        Where things stand
      </label>
      <textarea
        name="notes"
        rows={2}
        defaultValue={gate.notes ?? ""}
        placeholder="What's outstanding, who you're waiting on."
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/* --------------------------------- Tasks ---------------------------------- */

const TASK_WORDS: Record<ProjectTaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  blocked: "Blocked",
  done: "Done",
};

const TASK_TONE: Record<ProjectTaskStatus, "neutral" | "info" | "bad" | "good"> = {
  todo: "neutral",
  doing: "info",
  blocked: "bad",
  done: "good",
};

const PRIORITY_TONE: Record<TaskPriority, "bad" | "warn" | "neutral"> = {
  critical: "bad",
  high: "warn",
  medium: "neutral",
  low: "neutral",
};

export function Task({
  task,
  overdue,
}: {
  task: ProjectTaskRow;
  overdue: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, action] = useActionState(setTaskStatus, null);

  return (
    <li
      className={cn(
        "border-b border-tan/15 last:border-b-0",
        task.status === "done" && "bg-sage-pale/20",
        task.status === "blocked" && "bg-blush/20",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex flex-wrap items-center gap-2">
            {task.ref && (
              <span className="eyebrow !text-[0.55rem] text-ink-faint">
                {task.ref}
              </span>
            )}
            <span
              className={cn(
                "font-medium",
                task.status === "done" ? "text-ink-faint line-through" : "text-ink",
              )}
            >
              {task.title}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {[task.owner, task.workstream].filter(Boolean).join(" · ")}
            {task.due_on && (
              <span className={overdue && task.status !== "done" ? "text-burgundy" : ""}>
                {" · due "}
                {dateShort(task.due_on)}
              </span>
            )}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {task.priority !== "medium" && task.priority !== "low" && (
            <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
          )}
          <Badge tone={TASK_TONE[task.status]}>{TASK_WORDS[task.status]}</Badge>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-tan/15 bg-parchment/30 px-5 py-5">
          {task.why && (
            <div>
              <p className="eyebrow !text-[0.6rem] text-bark">Why it matters</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{task.why}</p>
            </div>
          )}

          {task.next_action && (
            <div>
              <p className="eyebrow !text-[0.6rem] text-bark">Next action</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {task.next_action}
              </p>
            </div>
          )}

          {task.dependency && task.dependency !== "None" && (
            <p className="text-xs text-ink-faint">
              Waiting on: {task.dependency}
            </p>
          )}

          <form action={action} className="space-y-3">
            <input type="hidden" name="id" value={task.id} />
            <div className="flex flex-wrap gap-2">
              {(["todo", "doing", "blocked", "done"] as ProjectTaskStatus[]).map(
                (s) => (
                  <button
                    key={s}
                    type="submit"
                    name="status"
                    value={s}
                    disabled={task.status === s}
                    className={cn(
                      "eyebrow rounded-full border px-3.5 py-1.5 !text-[0.58rem] transition-colors",
                      task.status === s
                        ? "cursor-default border-olive bg-olive text-cream"
                        : "border-tan/40 bg-cream text-bark hover:border-olive/50 hover:bg-sage-pale/40",
                    )}
                  >
                    {TASK_WORDS[s]}
                  </button>
                ),
              )}
            </div>
            <Feedback result={result} />
          </form>

          <TaskNotes task={task} />
        </div>
      )}
    </li>
  );
}

function TaskNotes({ task }: { task: ProjectTaskRow }) {
  const [result, action] = useActionState(saveTaskNotes, null);

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="id" value={task.id} />
      <textarea
        name="notes"
        rows={2}
        defaultValue={task.notes ?? ""}
        placeholder="Who you spoke to, what they said, what's next."
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save note</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
