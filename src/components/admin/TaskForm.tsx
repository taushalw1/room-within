"use client";

import { useActionState, useEffect } from "react";
import { addTask, updateTask } from "@/app/(admin)/admin/counselling/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { TaskRow } from "@/lib/data/types";

const AREAS: { value: TaskRow["area"]; label: string }[] = [
  { value: "general", label: "General" },
  { value: "rentals", label: "Rentals" },
  { value: "bookings", label: "Bookings" },
  { value: "finance", label: "Finance" },
  { value: "counselling", label: "Counselling" },
];

/** One form for both adding and editing a task. */
export function TaskForm({
  task,
  onSaved,
  onCancel,
}: {
  task?: TaskRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(task);
  const [result, action] = useActionState(editing ? updateTask : addTask, null);

  useEffect(() => {
    if (result?.ok && editing) onSaved?.();
  }, [result, editing, onSaved]);

  return (
    <form action={action} className="space-y-4">
      {task && <input type="hidden" name="taskId" value={task.id} />}

      <Field label="What needs doing">
        <input
          name="title"
          required
          defaultValue={task?.title}
          placeholder="Ring the roofer about the flashing quote"
          className={inputClass}
        />
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={task?.notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Due" hint="Optional.">
          <input
            name="dueDate"
            type="date"
            defaultValue={task?.due_date ?? ""}
            className={inputClass}
          />
        </Field>

        <Field label="Part of the business">
          <select
            name="area"
            defaultValue={task?.area ?? "general"}
            className={inputClass}
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            name="status"
            defaultValue={task?.status ?? "open"}
            className={inputClass}
          >
            <option value="open">To do</option>
            <option value="doing">In progress</option>
            <option value="done">Done</option>
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{editing ? "Save changes" : "Add to list"}</SubmitButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}
