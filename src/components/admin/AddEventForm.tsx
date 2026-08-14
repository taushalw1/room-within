"use client";

import { useActionState, useState } from "react";
import { format, addDays } from "date-fns";
import { addEvent } from "@/app/(admin)/admin/events/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import type { RoomRow } from "@/lib/data/types";

const CATEGORIES = [
  "community",
  "learning",
  "workshop",
  "wellbeing",
  "family",
  "fundraising",
];

export function AddEventForm({ rooms }: { rooms: RoomRow[] }) {
  const [result, action] = useActionState(addEvent, null);
  const [allDay, setAllDay] = useState(false);
  const [atBuilding, setAtBuilding] = useState(true);

  return (
    <form action={action} className="space-y-5">
      <Field label="What's it called">
        <input
          name="title"
          required
          placeholder="Thursday Morning Coffee Group"
          className={inputClass}
        />
      </Field>

      <Field label="Description" hint="This is what people read on the calendar.">
        <textarea
          name="description"
          rows={3}
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
              defaultValue={format(addDays(new Date(), 7), "yyyy-MM-dd")}
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
                  defaultValue="09:30"
                  className={inputClass}
                />
              </Field>
              <Field label="Finishes">
                <input
                  name="endTime"
                  type="time"
                  step={900}
                  required
                  defaultValue="11:00"
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
              <select name="roomId" className={inputClass}>
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
            placeholder="Room Within"
            className={inputClass}
          />
        </Field>
        <Field label="Contact email" hint="Optional.">
          <input name="contactEmail" type="email" className={inputClass} />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue="community" className={inputClass}>
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
          placeholder="https://"
          className={inputClass}
        />
      </Field>

      <CheckField
        name="publish"
        label="Put it on the community calendar now"
        defaultChecked
        hint="Leave unticked to save it as a draft only you can see."
      />

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Add event</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
