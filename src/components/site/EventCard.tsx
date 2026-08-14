import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { dateTimeRange } from "@/lib/format";
import type { EventRow } from "@/lib/data/types";

export function EventCard({
  event,
  className,
}: {
  event: EventRow;
  className?: string;
}) {
  const start = new Date(event.starts_at);

  return (
    <article
      className={cn(
        "group flex gap-4 rounded-[var(--radius-card)] border border-tan/25 bg-cream p-5 transition-shadow hover:shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {/* Torn-calendar date block */}
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[var(--radius-card)] bg-sage-pale/70 text-olive-deep">
        <span className="eyebrow text-[0.62rem] text-bark">
          {format(start, "MMM")}
        </span>
        <span className="font-display text-2xl font-semibold leading-none">
          {format(start, "d")}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-snug">
          {event.slug ? (
            <Link
              href={`/calendar/${event.slug}`}
              className="transition-colors hover:text-burgundy"
            >
              {event.title}
            </Link>
          ) : (
            event.title
          )}
        </h3>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {event.all_day
              ? `${format(start, "EEE d MMM")} · All day`
              : dateTimeRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {event.location}
            </span>
          )}
        </p>

        {event.description && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">
            {event.description}
          </p>
        )}

        {!event.is_at_building && (
          <span className="eyebrow mt-3 inline-block rounded-full bg-blush/70 px-2.5 py-1 text-[0.6rem] text-burgundy">
            Elsewhere in the community
          </span>
        )}
      </div>
    </article>
  );
}
