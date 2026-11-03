"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PenLine, ShieldCheck, ThumbsDown } from "lucide-react";
import {
  saveMyConditionView,
  signConditionReport,
  type ActionResult,
} from "@/app/(site)/portal/condition-actions";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Form";
import { RATINGS, RATING_LABEL, areasOf, type Rating } from "@/lib/condition";
import { dateShort } from "@/lib/format";
import type { ConditionItemRow, ConditionReportRow } from "@/lib/data/types";

/**
 * The inspection report, from the tenant's side.
 *
 * What Tausha recorded is shown as read-only, and their own view sits beside
 * it rather than replacing it. That is deliberate and it is the whole design:
 * a report that quietly keeps whichever answer was typed last is not evidence
 * of anything, whereas one that records a disagreement at the time it
 * happened protects both of them.
 *
 * Signing to disagree is offered just as plainly as signing to agree. A form
 * that only lets you consent is not collecting consent.
 */
export function ConditionReview({
  report,
  items,
  hasSignature,
}: {
  report: ConditionReportRow;
  items: ConditionItemRow[];
  hasSignature: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function sign(agreed: boolean) {
    const fd = new FormData();
    fd.set("reportId", report.id);
    fd.set("agreed", agreed ? "yes" : "no");
    start(async () => {
      const outcome = await signConditionReport(fd);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  const disagreements = items.filter(
    (i) => i.tenant_rating && i.rating && i.tenant_rating !== i.rating,
  ).length;

  return (
    <div>
      <div className="border-b border-tan/20 px-5 py-4 text-sm text-ink-soft">
        <p>
          Looked at on{" "}
          <strong>
            {report.inspected_on ? dateShort(report.inspected_on) : "a date not recorded"}
          </strong>
          . Below is what was written down. Where you see it differently, say
          so — it is kept alongside, not instead of.
        </p>
        {report.landlord_note && (
          <p className="mt-2 italic">&ldquo;{report.landlord_note}&rdquo;</p>
        )}
      </div>

      {areasOf(items).map((area) => (
        <div key={area}>
          <p className="eyebrow !text-[0.58rem] border-b border-tan/20 bg-parchment/50 px-5 py-2 text-bark">
            {area}
          </p>
          {items
            .filter((i) => i.area === area)
            .map((item) => (
              <TenantItem key={item.id} item={item} />
            ))}
        </div>
      ))}

      <div className="space-y-4 border-t border-tan/20 px-5 py-5">
        {!hasSignature ? (
          <p className="text-sm text-burgundy">
            Add your signature further up this page first — then you can sign
            this off.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              {disagreements === 0
                ? "You haven't disagreed with anything. If that's right, sign it off."
                : `You've marked ${disagreements} thing${
                    disagreements === 1 ? "" : "s"
                  } differently. Both versions are kept either way — sign to say which it is.`}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" disabled={pending} onClick={() => sign(true)}>
                <PenLine className="h-3.5 w-3.5" aria-hidden />
                Sign — this is accurate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={pending}
                onClick={() => sign(false)}
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                Sign — I don&rsquo;t agree with it
              </Button>
            </div>
          </>
        )}

        {result && (
          <p
            role="status"
            className={`text-sm ${result.ok ? "text-olive" : "text-burgundy"}`}
          >
            {result.message}
            {result.verifyCode && (
              <span className="mt-1 block font-mono text-xs text-ink-soft">
                Reference {result.verifyCode}
              </span>
            )}
          </p>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
          Once signed, neither of you can change it. The time and the device it
          was signed from are recorded, and you get a reference you can quote.
        </p>
      </div>
    </div>
  );
}

function TenantItem({ item }: { item: ConditionItemRow }) {
  const [rating, setRating] = useState<Rating | null>(
    item.tenant_rating as Rating | null,
  );
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function save(next: Rating, note: string) {
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("rating", next);
    fd.set("note", note);
    start(async () => {
      await saveMyConditionView(fd);
    });
  }

  const differs = rating && item.rating && rating !== item.rating;

  return (
    <div className="border-b border-tan/20 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-body text-[0.95rem] text-ink">{item.item}</p>
        <p className="text-xs text-ink-soft">
          Recorded as{" "}
          <strong className="text-bark">
            {item.rating ? RATING_LABEL[item.rating as Rating] : "not marked"}
          </strong>
        </p>
      </div>

      {item.note && <p className="mt-1 text-xs text-ink-soft">{item.note}</p>}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={pending}
            onClick={() => {
              setRating(r.value);
              save(r.value, item.tenant_note ?? "");
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

      {differs && (
        <p className="mt-1.5 text-xs text-burgundy">
          You see this differently — worth a line saying why.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs text-bark underline underline-offset-2"
        >
          {item.tenant_note ? "Edit your note" : "Add a note"}
        </button>
      ) : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const note = new FormData(e.currentTarget).get("note");
            save(rating ?? "good", String(note ?? ""));
            setOpen(false);
          }}
        >
          <textarea
            name="note"
            rows={2}
            defaultValue={item.tenant_note ?? ""}
            placeholder="What you noticed, and where."
            className={inputClass}
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Save
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {item.tenant_note && !open && (
        <p className="mt-1.5 text-xs italic text-ink-soft">{item.tenant_note}</p>
      )}
    </div>
  );
}
