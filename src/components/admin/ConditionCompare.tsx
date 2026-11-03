import { ArrowRight, Minus, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/Table";
import { RATING_LABEL, change, disagrees, type Rating } from "@/lib/condition";
import type { ConditionItemRow, ConditionReportRow } from "@/lib/data/types";
import { dateShort } from "@/lib/format";

/**
 * Move-in beside move-out, item by item.
 *
 * This is the only view of an inspection report that answers the question
 * anybody is really asking. A move-out report on its own says the carpet is
 * stained. Read against the move-in report it says whether that happened
 * during this tenancy, and that is the difference between a deduction that
 * holds up and one that doesn't.
 *
 * Items that did not change are collapsed to a quiet line. Twenty rows of
 * "good — good" is how the four rows that matter get missed.
 */
export function ConditionCompare({
  moveIn,
  moveOut,
}: {
  moveIn: { report: ConditionReportRow; items: ConditionItemRow[] } | null;
  moveOut: { report: ConditionReportRow; items: ConditionItemRow[] } | null;
}) {
  if (!moveIn || !moveOut) {
    return (
      <Card>
        <CardHeader
          title="Start and end, side by side"
          description="Needs both inspections before there is anything to compare."
          tone="plain"
        />
        <p className="px-5 py-6 text-sm text-ink-soft">
          {!moveIn && !moveOut
            ? "Neither inspection has been done for this tenancy."
            : !moveIn
              ? "There is no move-in inspection for this tenancy, so there is nothing to compare the move-out against. Without one it is very hard to argue that any damage happened during the tenancy."
              : "The move-out inspection hasn't been done yet."}
        </p>
      </Card>
    );
  }

  const byPosition = new Map(moveOut.items.map((i) => [i.position, i]));

  const rows = moveIn.items.map((before) => {
    const after = byPosition.get(before.position) ?? null;
    return {
      before,
      after,
      verdict: change(
        before.rating as Rating | null,
        (after?.rating ?? null) as Rating | null,
      ),
      argued: after
        ? disagrees(
            after.rating as Rating | null,
            after.tenant_rating as Rating | null,
          )
        : false,
    };
  });

  const changed = rows.filter((r) => r.verdict !== "same" || r.argued);
  const unchanged = rows.length - changed.length;

  return (
    <Card>
      <CardHeader
        title="Start and end, side by side"
        description={`Moved in ${
          moveIn.report.inspected_on ? dateShort(moveIn.report.inspected_on) : "—"
        }, moved out ${
          moveOut.report.inspected_on ? dateShort(moveOut.report.inspected_on) : "—"
        }.`}
        tone={changed.some((c) => c.verdict === "worse") ? "warn" : "sage"}
      />

      {changed.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Nothing changed between the two inspections, and nothing was
          disagreed about. All {rows.length} items came back the same.
        </p>
      ) : (
        <div>
          {changed.map(({ before, after, verdict, argued }) => (
            <div key={before.position} className="border-b border-tan/20 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[0.95rem] text-ink">{before.item}</p>
                  <p className="eyebrow !text-[0.58rem] text-bark">{before.area}</p>
                </div>
                <VerdictBadge verdict={verdict} argued={argued} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <RatingChip rating={before.rating as Rating | null} />
                <ArrowRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                <RatingChip rating={(after?.rating ?? null) as Rating | null} />
              </div>

              {(before.note || after?.note) && (
                <dl className="mt-2.5 space-y-1 text-xs text-ink-soft">
                  {before.note && (
                    <div>
                      <dt className="inline font-semibold text-bark">At move-in: </dt>
                      <dd className="inline">{before.note}</dd>
                    </div>
                  )}
                  {after?.note && (
                    <div>
                      <dt className="inline font-semibold text-bark">At move-out: </dt>
                      <dd className="inline">{after.note}</dd>
                    </div>
                  )}
                </dl>
              )}

              {/* Where the two sides differed, both are shown. Neither wins. */}
              {argued && after && (
                <div className="mt-2.5 rounded-[var(--radius-card)] bg-blush/40 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-burgundy">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    You saw this differently
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    <strong>You:</strong>{" "}
                    {after.rating ? RATING_LABEL[after.rating as Rating] : "nothing recorded"}
                    {" · "}
                    <strong>Them:</strong>{" "}
                    {after.tenant_rating
                      ? RATING_LABEL[after.tenant_rating as Rating]
                      : "nothing recorded"}
                  </p>
                  {after.tenant_note && (
                    <p className="mt-1 text-xs italic text-ink-soft">
                      &ldquo;{after.tenant_note}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {unchanged > 0 && (
        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          The other {unchanged} item{unchanged === 1 ? "" : "s"} came back the
          same as {unchanged === 1 ? "it" : "they"} went in, with no
          disagreement.
        </p>
      )}

      <p className="border-t border-tan/20 bg-parchment/40 px-5 py-3.5 text-xs leading-relaxed text-ink-faint">
        Fair wear and tear is not damage, and it cannot be deducted from a
        deposit. A carpet that has been walked on for a year is not the same as
        a carpet that has been burned.
      </p>
    </Card>
  );
}

function VerdictBadge({
  verdict,
  argued,
}: {
  verdict: "same" | "worse" | "better" | "unknown";
  argued: boolean;
}) {
  if (argued && verdict === "same") {
    return <Badge tone="bad">disagreed</Badge>;
  }
  if (verdict === "worse") {
    return (
      <Badge tone="bad">
        <TrendingDown className="h-3 w-3" aria-hidden /> worse
      </Badge>
    );
  }
  if (verdict === "better") {
    return (
      <Badge tone="good">
        <TrendingUp className="h-3 w-3" aria-hidden /> better
      </Badge>
    );
  }
  if (verdict === "unknown") return <Badge tone="neutral">not compared</Badge>;
  return (
    <Badge tone="neutral">
      <Minus className="h-3 w-3" aria-hidden /> same
    </Badge>
  );
}

function RatingChip({ rating }: { rating: Rating | null }) {
  if (!rating) {
    return <span className="text-xs text-ink-faint">nothing recorded</span>;
  }

  const tone =
    rating === "good"
      ? "bg-sage-pale text-olive-deep"
      : rating === "fair" || rating === "na"
        ? "bg-linen text-ink-soft"
        : rating === "poor"
          ? "bg-tan/30 text-bark"
          : "bg-blush text-burgundy";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {RATING_LABEL[rating]}
    </span>
  );
}
