import { addMonths, subMonths } from "date-fns";
import { getEventsInRange } from "@/lib/data/public";
import { buildIcs, calendarNames, icsResponse } from "@/lib/ics";
import { site } from "@/lib/site";

/**
 * The public community calendar feed.
 *
 * Anyone can subscribe: Google Calendar → Other calendars → From URL.
 * Only published events appear — drafts, cancelled events and private room
 * bookings are never included.
 */
export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET() {
  // A year ahead and three months back covers what calendar clients show.
  const events = await getEventsInRange(
    subMonths(new Date(), 3),
    addMonths(new Date(), 12),
  );

  const body = buildIcs({
    name: calendarNames.community,
    description: `Events at Room Within and across ${site.town}.`,
    events: events.map((e) => ({
      uid: e.id,
      title: e.title,
      description: [e.description, e.host_name && `Hosted by ${e.host_name}`]
        .filter(Boolean)
        .join("\n\n"),
      location:
        e.location ?? (e.is_at_building ? `${site.name}, ${site.town}` : null),
      start: new Date(e.starts_at),
      end: new Date(e.ends_at),
      allDay: e.all_day,
      url: e.slug ? `${SITE_URL}/calendar/${e.slug}` : SITE_URL + "/calendar",
      cancelled: e.status === "cancelled",
    })),
  });

  return icsResponse(body, "room-within-community.ics");
}
