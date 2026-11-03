import Link from "next/link";
import { Check, CircleDashed } from "lucide-react";
import { Badge, Card, CardHeader, EmptyRow } from "@/components/ui/Table";
import { moveInProgress, type MoveInFacts } from "@/lib/onboarding";

/**
 * How far along each new tenancy is.
 *
 * Only the ones that aren't finished appear. A tenancy where everything has
 * been done needs no row, and a card listing eight completed tenancies is a
 * card nobody reads — which means the one that still needs an inspection gets
 * missed.
 *
 * The next thing to do is named in full. "4 of 9" is a score; "next: record
 * the deposit" is a task, and only one of those gets done.
 */
export function MovingIn({
  tenancies,
}: {
  tenancies: {
    leaseId: string;
    who: string;
    unit: string;
    facts: MoveInFacts;
  }[];
}) {
  const unfinished = tenancies
    .map((t) => ({ ...t, progress: moveInProgress(t.facts, t.leaseId) }))
    .filter((t) => !t.progress.complete)
    // Furthest behind first: the tenancy with six things outstanding needs
    // attention before the one with one.
    .sort((a, b) => b.progress.outstanding.length - a.progress.outstanding.length);

  return (
    <Card>
      <CardHeader
        title="Settling in"
        description="Worked out from your records rather than ticked off by hand, so it can't go stale."
        tone={unfinished.some((t) => t.progress.outstanding.length > 0) ? "warn" : "sage"}
      />

      {unfinished.length === 0 ? (
        <EmptyRow colSpan={1}>
          Everyone is properly moved in — nothing outstanding.
        </EmptyRow>
      ) : (
        unfinished.map((t) => (
          <div key={t.leaseId} className="border-b border-tan/20 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{t.who}</p>
                <p className="text-sm text-ink-soft">{t.unit}</p>
              </div>
              <Badge tone={t.progress.outstanding.length > 0 ? "warn" : "neutral"}>
                {t.progress.done} of {t.progress.total}
              </Badge>
            </div>

            {t.progress.next && (
              <p className="mt-2 text-sm text-ink">
                <strong className="text-bark">Next:</strong>{" "}
                <Link
                  href={t.progress.next.href}
                  className="text-olive-deep underline underline-offset-2"
                >
                  {t.progress.next.label}
                </Link>{" "}
                <span className="text-ink-soft">— {t.progress.next.todo}</span>
              </p>
            )}

            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {t.progress.steps.map((s) => (
                <li
                  key={s.key}
                  className={`flex items-center gap-1.5 text-xs ${
                    s.done ? "text-ink-faint" : "text-bark"
                  }`}
                >
                  {s.done ? (
                    <Check className="h-3 w-3 text-olive" aria-hidden />
                  ) : (
                    <CircleDashed className="h-3 w-3" aria-hidden />
                  )}
                  {s.label}
                  {!s.done && s.weight === "worth doing" && (
                    <span className="text-ink-faint">(optional)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Card>
  );
}
