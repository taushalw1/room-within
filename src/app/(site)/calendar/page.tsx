import type { Metadata } from "next";
import { CalendarPlus, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ShareEvent } from "@/components/site/ShareEvent";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { getUpcomingEvents } from "@/lib/data/public";
import { dateTimeRange } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Community Calendar",
  description: `What's happening at Room Within and across ${site.town} — classes, groups, workshops and events.`,
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function CalendarPage() {
  const events = await getUpcomingEvents(60);

  // Group by month so a long list stays readable.
  const byMonth = new Map<string, typeof events>();
  for (const e of events) {
    const key = format(new Date(e.starts_at), "MMMM yyyy");
    byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
  }

  return (
    <Section tint="cream">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            align="left"
            eyebrow="Community Calendar"
            title="What's happening in"
            script="Grassy Lake"
            lead="Everything at Room Within, plus events happening elsewhere in the community."
          />
          <ButtonLink href="/calendar/subscribe" variant="secondary" size="md">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Add to your calendar
          </ButtonLink>
        </div>

        {events.length === 0 ? (
          <p className="mt-14 rounded-[var(--radius-card)] border border-dashed border-tan/50 bg-parchment/50 p-14 text-center text-ink-soft">
            Nothing on the calendar just yet — do check back.
          </p>
        ) : (
          <div className="mt-14 space-y-12">
            {[...byMonth.entries()].map(([month, monthEvents]) => (
              <section key={month}>
                <h2 className="eyebrow flex items-center gap-4 text-bark">
                  {month}
                  <span aria-hidden className="h-px flex-1 bg-tan/40" />
                </h2>

                <ul className="mt-6 space-y-4">
                  {monthEvents.map((e) => {
                    const start = new Date(e.starts_at);
                    const when = e.all_day
                      ? `${format(start, "EEEE d MMMM")} · All day`
                      : dateTimeRange(e.starts_at, e.ends_at);
                    const url = e.slug
                      ? `${SITE_URL}/calendar/${e.slug}`
                      : `${SITE_URL}/calendar`;

                    return (
                      <li
                        key={e.id}
                        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-tan/25 bg-parchment/45 p-6 sm:flex-row sm:gap-6"
                      >
                        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[var(--radius-card)] bg-sage-pale/80 text-olive-deep">
                          <span className="eyebrow !text-[0.6rem] text-bark">
                            {format(start, "EEE")}
                          </span>
                          <span className="font-display text-3xl font-semibold leading-none">
                            {format(start, "d")}
                          </span>
                          <span className="eyebrow !text-[0.55rem] text-bark">
                            {format(start, "MMM")}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl">{e.title}</h3>
                          <p className="mt-1 text-sm text-ink-soft">{when}</p>

                          {e.location && (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-soft">
                              <MapPin className="h-3.5 w-3.5" aria-hidden />
                              {e.location}
                              {!e.is_at_building && (
                                <span className="text-ink-faint">
                                  {" "}
                                  · elsewhere in the community
                                </span>
                              )}
                            </p>
                          )}

                          {e.description && (
                            <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
                              {e.description}
                            </p>
                          )}

                          {e.host_name && (
                            <p className="mt-2 text-xs text-ink-faint">
                              Hosted by {e.host_name}
                            </p>
                          )}

                          <div className="mt-4">
                            <ShareEvent
                              title={e.title}
                              when={when}
                              location={e.location}
                              url={url}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-14 text-center text-sm text-ink-soft">
          Running something the community should know about?{" "}
          <a
            href={`mailto:${site.email}?subject=${encodeURIComponent("Event for the community calendar")}`}
            className="text-burgundy underline-offset-4 hover:underline"
          >
            Send us the details
          </a>{" "}
          and we&rsquo;ll add it — it doesn&rsquo;t have to be at Room Within.
        </p>
      </Container>
    </Section>
  );
}
