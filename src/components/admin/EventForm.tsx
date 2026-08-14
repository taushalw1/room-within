"use client";

import { useActionState, useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { addEvent, updateEvent } from "@/app/(admin)/admin/events/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { EventRow, RoomRow } from "@/lib/data/types";

const CATEGORIES = [
  "community",
  "learning",
  "workshop",
  "wellbeing",
  "family",
  "fundraising",
];

/**
 * One form for both adding and editing.
 *
 * Pass `event` to edit it; leave it out to add a new one. Keeping these as a
 * single component means the fields, the conditional logic and the wording
 * can't drift apart between the two.
 */
export function EventForm({
  rooms,
  event,
  onSaved,
  onCancel,
}: {
  rooms: RoomRow[];
  event?: EventRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(event);
  const [result, action] = useActionState(
    editing ? updateEvent : addEvent,
    null,
  );

  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [atBuilding, setAtBuilding] = useState(event?.is_at_building ?? true);

  // Collapse the row once the save has actually succeeded.
  useEffect(() => {
    if (result?.ok && editing) onSaved?.();
  }, [result, editing, onSaved]);

  const start = event ? new Date(event.starts_at) : null;
  const end = event ? new Date(event.ends_at) : null;

  return (
    <form action={action} className="space-y-5">
      {event && <input type="hidden" name="eventId" value={event.id} />}

      <Field label="What's it called">
        <input
          name="title"
          required
          defaultValue={event?.title}
          placeholder="Thursday Morning Coffee Group"
          className={inputClass}
        />
      </Field>

      <Field label="Description" hint="This is what people read on the calendar.">
        <textarea
          name="description"
          rows={3}
          defaultValue={event?.description ?? ""}
          placeholder="Drop in for a cup and a chat. No sign-up, no cost — just come."
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* When */}
      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <input
              name="date"
              type="date"
              required
              defaultValue={format(
                start ?? addDays(new Date(), 7),
                "yyyy-MM-dd",
              )}
              className={inputClass}
            />
          </Field>

          {!allDay && (
            <>
              <Field label="Starts">
                <input
                  name="startTime"
                  type="time"
                  step={900}
                  required
                  defaultValue={start ? format(start, "HH:mm") : "09:30"}
                  className={inputClass}
                />
              </Field>
              <Field label="Finishes">
                <input
                  name="endTime"
                  type="time"
                  step={900}
                  required
                  defaultValue={end ? format(end, "HH:mm") : "11:00"}
                  className={inputClass}
                />
              </Field>
            </>
          )}
        </div>

        <div className="mt-4">
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
            />
            <span>It runs all day</span>
          </label>
        </div>
      </div>

      {/* Where */}
      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <label className="flex items-start gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="atBuilding"
            checked={atBuilding}
            onChange={(e) => setAtBuilding(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
          />
          <span>
            It&rsquo;s here at Room Within
            <span className="block text-xs text-ink-faint">
              Untick for events elsewhere in Grassy Lake — they still show on the
              community calendar.
            </span>
          </span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {atBuilding && (
            <Field label="Which room" hint="Optional — helps avoid clashes.">
              <select
                name="roomId"
                defaultValue={event?.room_id ?? ""}
                className={inputClass}
              >
                <option value="">Not a specific room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label={atBuilding ? "Where exactly" : "Where is it"}
            hint={atBuilding ? "Shown on the calendar." : undefined}
          >
            <input
              name="location"
              defaultValue={event?.location ?? ""}
              placeholder={
                atBuilding ? "The Gathering Room" : "Main Street, Grassy Lake"
              }
              required={!atBuilding}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* Who */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Who's running it">
          <input
            name="hostName"
            defaultValue={event?.host_name ?? ""}
            placeholder="Room Within"
            className={inputClass}
          />
        </Field>
        <Field label="Contact email" hint="Optional.">
          <input
            name="contactEmail"
            type="email"
            defaultValue={event?.contact_email ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Category">
          <select
            name="category"
            defaultValue={event?.category ?? "community"}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Link for more details" hint="Optional — a Facebook post, say.">
        <input
          name="externalUrl"
          type="url"
          defaultValue={event?.external_url ?? ""}
          placeholder="https://"
          className={inputClass}
        />
      </Field>

      <CheckField
        name="publish"
        label={
          editing
            ? "Keep it on the community calendar"
            : "Put it on the community calendar now"
        }
        defaultChecked={event ? event.status === "published" : true}
        hint={
          event?.status === "cancelled"
            ? "This event is cancelled. Saving won't change that — use Publish to put it back."
            : "Leave unticked to keep it as a draft only you can see."
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{editing ? "Save changes" : "Add event"}</SubmitButton>
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
