import Link from "next/link";
import { History } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader } from "@/components/ui/Table";
import { getAuditTables, getAuditTrail } from "@/lib/data/audit";
import { actorLabel, describe, headline, tableLabel } from "@/lib/audit";
import { cn } from "@/lib/cn";

export const metadata = { title: "Record of changes" };

function when(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  return then.toLocaleString("en-CA", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ of?: string }>;
}) {
  await requireAdmin();
  const { of } = await searchParams;

  const [rows, tables] = await Promise.all([
    getAuditTrail({ table: of }),
    getAuditTables(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="A record"
        title="Record of changes"
        description="Every change to the money and the tenancies — who made it and when. This is about your records, not about the app: for what has been added or improved in the app itself, see What's new."
      />

      <Card>
        <CardHeader
          title="Recent changes"
          description="Newest first. Counselling records are deliberately not listed: they are health information, and a second copy of them is exactly what the law is trying to prevent."
        />

        {tables.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-tan/20 bg-parchment px-5 py-3">
            <Link
              href="/admin/history"
              className={cn(
                "rounded-full px-3 py-1 text-xs transition",
                !of ? "bg-olive text-cream" : "bg-tan/15 text-bark hover:bg-tan/30",
              )}
            >
              Everything
            </Link>
            {tables.map((t) => (
              <Link
                key={t}
                href={`/admin/history?of=${t}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition",
                  of === t ? "bg-olive text-cream" : "bg-tan/15 text-bark hover:bg-tan/30",
                )}
              >
                {tableLabel(t)}
              </Link>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="px-5 py-5 text-sm leading-relaxed text-ink-soft">
            Nothing recorded yet. This fills itself in from now on — the next
            time a rent changes, an invoice is raised or a cost is entered, it
            will say so here.
          </p>
        ) : (
          <ul className="divide-y divide-tan/20">
            {rows.map((row) => {
              const lines = describe(row);
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium text-ink">{headline(row)}</p>
                    <p className="text-xs text-ink-faint">
                      {when(row.at)} · {actorLabel(row)}
                    </p>
                  </div>
                  {lines.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {lines.map((line, i) => (
                        <li key={i} className="text-sm text-ink-soft">
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="flex items-start gap-2 border-t border-tan/20 px-5 py-3.5 text-xs leading-relaxed text-ink-faint">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          &ldquo;The app, on its own&rdquo; means a change nobody made by hand:
          the overnight rent run, a payment arriving from Stripe, a late fee, a
          reminder. Those are the ones hardest to account for afterwards, which
          is why they are listed too.
        </p>
      </Card>
    </div>
  );
}
