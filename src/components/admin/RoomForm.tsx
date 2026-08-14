"use client";

import { useActionState, useEffect } from "react";
import { createRoom, updateRoom } from "@/app/(admin)/admin/settings/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { RoomRow } from "@/lib/data/types";

const money = (cents: number | null) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

/** One form for both adding a room and editing an existing one. */
export function RoomForm({
  room,
  onSaved,
  onCancel,
}: {
  room?: RoomRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(room);
  const [result, action] = useActionState(editing ? updateRoom : createRoom, null);

  useEffect(() => {
    if (result?.ok && editing) onSaved?.();
  }, [result, editing, onSaved]);

  return (
    <form action={action} className="space-y-5">
      {room && <input type="hidden" name="roomId" value={room.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room name">
          <input
            name="name"
            required
            defaultValue={room?.name}
            className={inputClass}
          />
        </Field>
        <Field label="Seats how many">
          <input
            name="capacity"
            type="number"
            min="0"
            defaultValue={room?.capacity ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description" hint="Shown on Our Spaces and the booking page.">
        <textarea
          name="description"
          rows={2}
          defaultValue={room?.description ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Per hour">
            <input
              name="hourly"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={room ? money(room.hourly_rate_cents) : ""}
              className={inputClass}
            />
          </Field>
          <Field label="Half day" hint="Leave empty if not offered.">
            <input
              name="halfDay"
              type="number"
              step="0.01"
              min="0"
              defaultValue={room ? money(room.half_day_rate_cents) : ""}
              className={inputClass}
            />
          </Field>
          <Field label="Full day" hint="Leave empty if not offered.">
            <input
              name="fullDay"
              type="number"
              step="0.01"
              min="0"
              defaultValue={room ? money(room.full_day_rate_cents) : ""}
              className={inputClass}
            />
          </Field>
          <Field label="Shortest booking" hint="In hours.">
            <input
              name="minHours"
              type="number"
              step="0.25"
              min="0.25"
              required
              defaultValue={room?.min_hours ?? 1}
              className={inputClass}
            />
          </Field>
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          Whichever rate works out cheapest is the one people are charged, so a
          long booking never costs more than the day rate.
        </p>
      </div>

      <div className="space-y-3">
        <CheckField
          name="requiresApproval"
          label="You confirm bookings for this room before anyone pays"
          defaultChecked={room ? room.requires_approval : true}
          hint="Leave unticked to let people book and pay straight away."
        />
        <CheckField
          name="isBookable"
          label="Show this room on the website"
          defaultChecked={room ? room.is_bookable : true}
          hint="Untick to take it off Our Spaces and the booking page."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{editing ? "Save rates" : "Add room"}</SubmitButton>
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
