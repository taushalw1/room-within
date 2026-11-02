import Link from "next/link";
import { ArrowRight, Hand } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/Table";
import { MarkUpdatesSeen } from "@/components/admin/MarkUpdatesSeen";
import { updates, type UpdateEntry } from "@/content/updates";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "What's new" };

const LABEL: Record<UpdateEntry["kind"], { text: string; className: string }> = {
  new: { text: "New", className: "bg-olive text-cream" },
  better: { text: "Better", className: "bg-sage-pale text-olive-deep" },
  fixed: { text: "Fixed", className: "bg-tan/25 text-bark" },
};

export default async function WhatsNewPage() {
  await requireAdmin();

  // Grouped by the day they went live, so a day's work reads as a day's work
  // rather than as ten separate announcements.
  const days = updates.reduce<Record<string, UpdateEntry[]>>((acc, entry) => {
    (acc[entry.date] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <MarkUpdatesSeen />

      <PageHeader
        eyebrow="The app itself"
        title="What's new"
        description="Everything that's been added or improved, in plain words. Newest first. Anything that needs a decision from you says so."
      />

      {Object.entries(days).map(([date, entries]) => (
        <section key={date} className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-2xl font-semibold text-olive-deep">
              {dateShort(date)}
            </h2>
            <span className="h-px flex-1 bg-tan/30" />
            <span className="text-xs text-ink-faint">
              {entries.length} {entries.length === 1 ? "thing" : "things"}
            </span>
          </div>

          {entries.map((entry) => (
            <Card key={entry.title}>
              <div className="space-y-3 px-5 py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider",
                      LABEL[entry.kind].className,
                    )}
                  >
                    {LABEL[entry.kind].text}
                  </span>
                  <h3 className="font-display text-xl font-semibold text-ink">
                    {entry.title}
                  </h3>
                </div>

                <p className="max-w-3xl leading-relaxed text-ink-soft">
                  {entry.summary}
                </p>

                {entry.points && (
                  <ul className="max-w-3xl space-y-1.5">
                    {entry.points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2.5 text-[0.95rem] leading-relaxed text-ink-soft"
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-tan" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}

                {entry.needsYou && (
                  <p className="flex max-w-3xl items-start gap-2.5 rounded-[var(--radius-card)] bg-burgundy/5 px-4 py-3 text-[0.95rem] leading-relaxed text-burgundy">
                    <Hand className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-medium">Over to you.</strong>{" "}
                      {entry.needsYou}
                    </span>
                  </p>
                )}

                {entry.link && (
                  <Link
                    href={entry.link.href}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-olive-deep underline underline-offset-4"
                  >
                    {entry.link.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </section>
      ))}

      <p className="px-1 text-xs leading-relaxed text-ink-faint">
        Something here not working the way you expected, or not making sense?
        Say so — that&rsquo;s worth knowing, and it&rsquo;s usually quick to
        change.
      </p>
    </div>
  );
}
