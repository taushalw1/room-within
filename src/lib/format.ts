import { format, formatDistanceToNowStrict, isSameDay } from "date-fns";

/** Everything in the database is stored in cents to avoid float rounding. */
export function money(cents: number | null | undefined) {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Precise version for invoices and financial tables — always two decimals. */
export function moneyExact(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format((cents ?? 0) / 100);
}

export function toCents(input: string | number) {
  const n = typeof input === "number" ? input : parseFloat(input.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Turn a stored value into a Date for display.
 *
 * A bare "2026-09-15" — which is how Postgres hands back a `date` column — is
 * parsed by JavaScript as midnight *UTC*. Formatting that anywhere west of
 * Greenwich renders the day before: an invoice due on the 15th showed as the
 * 14th, and a deadline could look a day closer than it is. Bare dates are
 * therefore read as local midnight, which is what the person who typed them
 * meant. Full timestamps still carry their own zone and are left alone.
 */
const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function asDate(d: Date | string): Date {
  if (typeof d === "string" && DATE_ONLY.test(d)) return new Date(`${d}T00:00:00`);
  return new Date(d);
}

export const dateLong = (d: Date | string) =>
  format(asDate(d), "EEEE, d MMMM yyyy");

export const dateShort = (d: Date | string) => format(asDate(d), "d MMM yyyy");

export const timeOnly = (d: Date | string) => format(asDate(d), "h:mm a");

export const relative = (d: Date | string) =>
  formatDistanceToNowStrict(asDate(d), { addSuffix: true });

/**
 * "Sat 14 Jun · 7:00–9:00 PM", collapsing the date when it doesn't change.
 *
 * The am/pm is dropped from the start time only when both ends share it —
 * otherwise "9:00–12:00 PM" reads as if the morning start were afternoon.
 */
export function dateTimeRange(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = format(s, "EEE d MMM");

  if (isSameDay(s, e)) {
    const sameMeridiem = format(s, "a") === format(e, "a");
    const startText = sameMeridiem ? format(s, "h:mm") : format(s, "h:mm a");
    return `${day} · ${startText}–${format(e, "h:mm a")}`;
  }

  return `${day} ${format(s, "h:mm a")} – ${format(e, "EEE d MMM h:mm a")}`;
}

export function hoursBetween(start: Date | string, end: Date | string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

/**
 * How long somebody has been somewhere, in words.
 *
 * Matters most for the tenancies inherited with a building: "since 14 Mar
 * 2019" is a date you have to do arithmetic on, and "7 years" is the fact you
 * actually wanted. A long-standing tenant is treated differently from a new
 * one, and the length of their tenancy is the thing that tells you which.
 */
export function lengthOfStay(from: Date | string, to: Date | string = new Date()) {
  const start = asDate(from);
  const end = asDate(to);

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  // Not a full month until the day of the month has come round again.
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) return "not yet started";
  if (months === 0) return "under a month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;

  const years = Math.floor(months / 12);
  const rest = months % 12;

  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}, ${rest} month${rest === 1 ? "" : "s"}`;
}
