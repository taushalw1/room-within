import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ShareEvent } from "@/components/site/ShareEvent";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Section";
import { getUpcomingEvents } from "@/lib/data/public";
import { dateTimeRange } from "@/lib/format";
import { site } from "@/lib/site";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function findEvent(slug: string) {
  const events = await getUpcomingEvents(200);
  return events.find((e) => e.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await findEvent(slug);
  if (!event) return { title: "Event not found" };

  return {
    title: event.title,
    description:
      event.description?.slice(0, 160) ??
      `${event.title} — ${site.name}, ${site.town}`,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await findEvent(slug);
  if (!event) notFound();

  const start = new Date(event.starts_at);
  const when = event.all_day
    ? `${format(start, "EEEE d MMMM yyyy")} · All day`
    : dateTimeRange(event.starts_at, event.ends_at);

  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-2xl">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-olive-deep"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All events
          </Link>

          <p className="eyebrow mt-8 text-bark">{event.category ?? "Event"}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{event.title}</h1>

          <div className="mt-6 space-y-2 text-ink-soft">
            <p className="text-lg">{when}</p>
            {event.location && (
              <p className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden />
                {event.location}
                {!event.is_at_building && (
                  <span className="text-ink-faint">
                    {" "}
                    · elsewhere in the community
                  </span>
                )}
              </p>
            )}
            {event.host_name && (
              <p className="text-sm text-ink-faint">
                Hosted by {event.host_name}
              </p>
            )}
          </div>

          {event.description && (
            <div className="mt-8 whitespace-pre-line text-[1.05rem] leading-relaxed text-ink-soft">
              {event.description}
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/calendar/subscribe" size="lg">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Add our calendar to yours
            </ButtonLink>
            {event.external_url && (
              <ButtonLink
                href={event.external_url}
                variant="secondary"
                size="lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                More details
              </ButtonLink>
            )}
          </div>

          <div className="mt-8 border-t border-tan/25 pt-6">
            <p className="eyebrow mb-3 text-bark">Tell someone</p>
            <ShareEvent
              title={event.title}
              when={when}
              location={event.location}
              url={`${SITE_URL}/calendar/${event.slug}`}
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
