import { site } from "@/lib/site";

/**
 * Minimal iCalendar (RFC 5545) generator.
 *
 * Google Calendar, Apple Calendar and Outlook all subscribe to a URL that
 * returns text/calendar. Written by hand rather than pulled in as a dependency
 * — the format is small and the rules that matter are the escaping and the
 * 75-octet line folding, both of which are handled below.
 */

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  end: Date;
  allDay?: boolean;
  url?: string | null;
  /** Bumped whenever the event changes, so subscribers pick up edits. */
  updatedAt?: Date;
  cancelled?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC form: 20260814T193000Z */
function stampUtc(d: Date) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Date-only form for all-day events: 20260814 */
function stampDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Commas, semicolons, backslashes and newlines all carry meaning in ICS. */
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Content lines must not exceed 75 octets; continuations start with a space.
 * Measured in bytes, not characters, so accented names don't break the fold.
 */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Don't split a multi-byte character across the fold.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines lose one octet to the leading space
  }

  return parts.join("\r\n ");
}

export function buildIcs(opts: {
  name: string;
  description?: string;
  events: IcsEvent[];
  /** Minutes clients should wait before refetching. */
  refreshMinutes?: number;
}) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Room Within Community//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `NAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:America/Edmonton`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshMinutes ?? 60}M`,
    `X-PUBLISHED-TTL:PT${opts.refreshMinutes ?? 60}M`,
  ];

  if (opts.description) {
    lines.push(`X-WR-CALDESC:${escapeText(opts.description)}`);
  }

  for (const e of opts.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.uid}@roomwithin`);
    lines.push(`DTSTAMP:${stampUtc(e.updatedAt ?? new Date())}`);

    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${stampDate(e.start)}`);
      // DTEND is exclusive for all-day events.
      const endExclusive = new Date(e.end);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${stampDate(endExclusive)}`);
    } else {
      lines.push(`DTSTART:${stampUtc(e.start)}`);
      lines.push(`DTEND:${stampUtc(e.end)}`);
    }

    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Standard response headers for a calendar feed. */
export function icsResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      // Calendar clients poll often; a short cache keeps the load sane without
      // making edits take long to show up.
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}

export const calendarNames = {
  community: `${site.name} — Community Calendar`,
  counselling: "Counselling schedule (private)",
};
