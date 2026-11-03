"use client";

import { useState, useTransition } from "react";
import { Camera, Check, Users } from "lucide-react";
import {
  saveConditionItem,
  type ActionResult,
} from "@/app/(admin)/admin/rentals/condition-actions";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Form";
import { RATINGS, RATING_LABEL, type Rating } from "@/lib/condition";
import type { ConditionItemRow } from "@/lib/data/types";

/**
 * One line of an inspection, as it is being filled in.
 *
 * The marks are buttons rather than a dropdown. A walk-through is done on a
 * phone, standing in a cold hallway, and twenty dropdowns is twenty chances to
 * pick the wrong thing — whereas a row of buttons is one tap and shows its
 * answer without being opened.
 */
export function ConditionItemEditor({
  item,
  readOnly,
  photoUrl,
}: {
  item: ConditionItemRow;
  /** Once the report is with the tenant, her side stops being editable. */
  readOnly: boolean;
  photoUrl: string | null;
}) {
  const [rating, setRating] = useState<Rating | null>(item.rating as Rating | null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function save(next: Rating, note: string, photo?: File | null) {
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("rating", next);
    fd.set("note", note);
    if (photo) fd.set("photo", photo);
    start(async () => setResult(await saveConditionItem(fd)));
  }

  const argued =
    item.rating && item.tenant_rating && item.rating !== item.tenant_rating;

  if (readOnly) {
    return (
      <div className="border-b border-tan/20 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-[0.95rem] text-ink">{item.item}</p>
          <span className="text-sm font-semibold text-bark">
            {item.rating ? RATING_LABEL[item.rating as Rating] : "not marked"}
          </span>
        </div>
        {item.note && <p className="mt-1 text-xs text-ink-soft">{item.note}</p>}
        {argued && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-burgundy">
            <Users className="h-3.5 w-3.5" aria-hidden />
            They said{" "}
            {item.tenant_rating ? RATING_LABEL[item.tenant_rating as Rating] : "—"}
            {item.tenant_note ? ` — “${item.tenant_note}”` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-tan/20 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-body text-[0.95rem] text-ink">{item.item}</p>
        {photoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt=""
            className="h-12 w-12 rounded-[var(--radius-card)] object-cover"
          />
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={pending}
            onClick={() => {
              setRating(r.value);
              save(r.value, item.note ?? "");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              rating === r.value
                ? "bg-olive text-cream"
                : "bg-linen text-ink-soft hover:bg-sage-pale"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs text-bark underline underline-offset-2"
        >
          {item.note ? "Edit the note" : "Add a note or a photo"}
        </button>
      )}

      {item.note && !open && (
        <p className="mt-1.5 text-xs text-ink-soft">{item.note}</p>
      )}

      {open && (
        <form
          className="mt-2.5 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const photo = form.get("photo");
            save(
              rating ?? "good",
              String(form.get("note") ?? ""),
              photo instanceof File && photo.size > 0 ? photo : null,
            );
            setOpen(false);
          }}
        >
          <textarea
            name="note"
            rows={2}
            defaultValue={item.note ?? ""}
            placeholder="What exactly, and where — specific beats tidy."
            className={inputClass}
          />
          <label className="flex items-center gap-2 text-xs text-bark">
            <Camera className="h-3.5 w-3.5" aria-hidden />
            <input type="file" name="photo" accept="image/*" className="text-xs" />
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {result && !result.ok && (
        <p role="status" className="mt-1.5 text-xs text-burgundy">
          {result.message}
        </p>
      )}
    </div>
  );
}
