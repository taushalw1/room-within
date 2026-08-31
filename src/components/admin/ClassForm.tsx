"use client";

import { useActionState, useEffect } from "react";
import { addClass, updateClass } from "@/app/(admin)/admin/classes/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import type { ClassRow, InstructorRow, RoomRow } from "@/lib/data/types";

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function ClassForm({
  klass,
  instructors,
  rooms,
  onSaved,
  onCancel,
}: {
  klass?: ClassRow;
  instructors: InstructorRow[];
  rooms: RoomRow[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(klass ? updateClass : addClass, null);

  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  return (
    <form action={action} className="space-y-5">
      {klass && <input type="hidden" name="classId" value={klass.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is it called">
          <input
            name="title"
            required
            defaultValue={klass?.title}
            placeholder="Grassy Lake Arts Club"
            className={inputClass}
          />
        </Field>
        <Field label="Who teaches it">
          <select
            name="instructorId"
            defaultValue={klass?.instructor_id ?? ""}
            className={inputClass}
          >
            <option value="">Nobody yet</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.display_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="One line for the listing">
        <input
          name="summary"
          defaultValue={klass?.summary ?? ""}
          placeholder="Painting and mixed media, Thursday evenings."
          className={inputClass}
        />
      </Field>

      <Field label="The longer description">
        <textarea
          name="description"
          rows={3}
          defaultValue={klass?.description ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Which room">
          <select
            name="roomId"
            defaultValue={klass?.room_id ?? ""}
            className={inputClass}
          >
            <option value="">Not set</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Minutes per session">
          <input
            name="sessionMinutes"
            type="number"
            min="15"
            step="15"
            defaultValue={klass?.session_minutes ?? 90}
            className={inputClass}
          />
        </Field>
        <Field label="Most people it fits">
          <input
            name="capacity"
            type="number"
            min="1"
            defaultValue={klass?.capacity ?? 10}
            className={inputClass}
          />
        </Field>
        <Field label="Fewest to run" hint="Below this it cancels itself.">
          <input
            name="minHeadcount"
            type="number"
            min="0"
            defaultValue={klass?.min_headcount ?? 3}
            className={inputClass}
          />
        </Field>
      </div>

      {/* ---- The sliding scale ---- */}
      <div className="rounded-[var(--radius-card)] bg-parchment/60 p-4">
        <p className="eyebrow !text-[0.6rem] text-bark">What it costs</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          People choose their own price. Nobody has to ask for a discount, and
          the instructor is paid the same whichever one is picked — the
          difference comes out of the scholarship fund.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Full price">
            <input
              name="fullPrice"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={klass ? dollars(klass.full_price_cents) : "20.00"}
              className={inputClass}
            />
          </Field>
          <Field label="Reduced">
            <input
              name="reducedPrice"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={klass ? dollars(klass.reduced_price_cents) : "12.00"}
              className={inputClass}
            />
          </Field>
          <Field label="Subsidized">
            <input
              name="subsidizedPrice"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={
                klass ? dollars(klass.subsidized_price_cents) : "5.00"
              }
              className={inputClass}
            />
          </Field>
          <Field label="Subsidized seats" hint="Per session, at most.">
            <input
              name="subsidizedSeatCap"
              type="number"
              min="0"
              defaultValue={klass?.subsidized_seat_cap ?? 3}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ---- Private to Tausha ---- */}
      <div className="rounded-[var(--radius-card)] border border-tan/30 bg-cream p-4">
        <p className="eyebrow !text-[0.6rem] text-bark">Your records only</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          Never shown to anyone booking. The materials figure is the
          instructor&rsquo;s own cost — it isn&rsquo;t split and it isn&rsquo;t
          deducted, it just tells you whether the price still works for them.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Materials per person">
            <input
              name="materialsCost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={klass ? dollars(klass.materials_cost_cents) : "0.00"}
              className={inputClass}
            />
          </Field>
          <Field label="What the materials are" className="sm:col-span-2">
            <input
              name="materialsNote"
              defaultValue={klass?.materials_note ?? ""}
              placeholder="Acrylic paint, canvas, brushes."
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Credits to attend"
          hint="A standard class is 1. A specialty class is 2."
        >
          <input
            name="creditCost"
            type="number"
            min="0"
            max="10"
            defaultValue={klass?.credit_cost ?? 1}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={klass?.status ?? "draft"}
            className={inputClass}
          >
            <option value="draft">Draft — not listed yet</option>
            <option value="open">Open for sign-ups</option>
            <option value="full">Full</option>
            <option value="finished">Finished</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </div>

      <CheckField
        name="isPublic"
        label="Show this on the website"
        defaultChecked={klass?.is_public ?? true}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{klass ? "Save changes" : "Add the class"}</SubmitButton>
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
