"use client";

import { useActionState, useCallback, useState } from "react";
import { Check, Loader2, Pencil, RotateCcw } from "lucide-react";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { TaskForm } from "@/components/admin/TaskForm";
import { Badge } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import {
  cycleTaskStatus,
  deleteTask,
} from "@/app/(admin)/admin/counselling/actions";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TaskRow } from "@/lib/data/types";

/** Ticking a task off shouldn't need the edit form, so it gets its own button. */
function StatusButton({ task }: { task: TaskRow }) {
  const [result, action, pending] = useActionState(cycleTaskStatus, null);

  const next =
    task.status === "done"
      ? { value: "open", label: "Reopen", Icon: RotateCcw }
      : { value: "done", label: "Done", Icon: Check };

  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="status" value={next.value} />
      <Button
        size="sm"
        variant={task.status === "done" ? "ghost" : "secondary"}
        type="submit"
        disabled={pending}
        title={result && !result.ok ? result.message : undefined}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <next.Icon className="h-3.5 w-3.5" aria-hidden />
        )}
        {next.label}
      </Button>
    </form>
  );
}

export function TaskItem({ task }: { task: TaskRow }) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  const done = task.status === "done";
  const overdue =
    !done &&
    task.due_date &&
    new Date(task.due_date) < new Date(new Date().toDateString());

  if (editing) {
    return (
      <li className="bg-sage-pale/20 px-5 py-5">
        <TaskForm task={task} onSaved={stopEditing} onCancel={stopEditing} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-3.5">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          done ? "bg-linen" : task.status === "doing" ? "bg-tan" : "bg-sage",
        )}
      />

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done && "text-ink-faint line-through")}>
          {task.title}
        </p>
        {task.notes && <p className="text-xs text-ink-soft">{task.notes}</p>}
      </div>

      <Badge tone="neutral">{task.area}</Badge>
      {task.due_date && (
        <Badge tone={overdue ? "bad" : "neutral"}>
          {dateShort(task.due_date)}
        </Badge>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusButton task={task} />
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </Button>
        <ConfirmAction
          id={task.id}
          action={deleteTask}
          question={`Delete "${task.title}"? This can’t be undone.`}
        />
      </div>
    </li>
  );
}
