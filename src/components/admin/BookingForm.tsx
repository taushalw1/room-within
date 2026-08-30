"use client";

import { useActionState, useEffect } from "react";
import { format } from "date-fns";
import { updateBooking } from "@/app/(admin)/admin/bookings/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { hoursBetween, moneyExact } from "@/lib/format";
import type { BookingRow, RoomRow } from "@/lib/data/types";

const DURATIONS = [1, 1.5, 2, 3, 4, 6, 8, 10, 12];

export function BookingForm({
  booking,
  rooms,
  onSaved,
  onCancel,
}: {
  booking: BookingRow;
  rooms: RoomRow[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(updateBooking, null);

  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  const start = new Date(booking.starts_at);
  const currentHours = hoursBetween(booking.starts_at, booking.ends_at);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="bookingId" value={booking.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room">
          <select
            name="roomId"
            defaultValue={booking.room_id}
            className={inputClass}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What to call it">
          <input
            name="title"
            required
            defaultValue={booking.title}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <input
              name="date"
              type="date"
              required
              defaultValue={format(start, "yyyy-MM-dd")}
              className={inputClass}
            />
          </Field>
          <Field label="Starting at">
            <input
              name="startTime"
              type="time"
              step={900}
              required
              defaultValue={format(start, "HH:mm")}
              className={inputClass}
            />
          </Field>
          <Field label="For how long">
            <select
              name="hours"
              defaultValue={String(currentHours)}
              className={inputClass}
            >
              {[...new Set([currentHours, ...DURATIONS])]
                .sort((a, b) => a - b)
                .map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "hour" : "hours"}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          If the room is already taken over any of that time, the change is
          refused — two bookings can&rsquo;t overlap.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Who it's for">
          <input
            name="bookerName"
            required
            defaultValue={booking.booker_name}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            name="bookerEmail"
            type="email"
            required
            defaultValue={booking.booker_email}
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            name="bookerPhone"
            type="tel"
            defaultValue={booking.booker_phone ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Roughly how many people">
          <input
            name="attendees"
            type="number"
            min="1"
            defaultValue={booking.attendees ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Anything they mentioned">
          <input
            name="purpose"
            defaultValue={booking.purpose ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Your notes" hint="Not shown to them.">
        <textarea
          name="adminNotes"
          rows={2}
          defaultValue={booking.admin_notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="space-y-3">
        <CheckField
          name="isPublic"
          label="Show this on the public community calendar"
          defaultChecked={booking.is_public}
        />
        <CheckField
          name="reprice"
          label={`Recalculate the price — currently ${moneyExact(booking.total_cents)}`}
          hint={
            booking.is_paid
              ? "They have already paid. Only tick this if you intend to refund or charge the difference yourself."
              : "Leave unticked to hold them to the amount they were quoted."
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save changes</SubmitButton>
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
