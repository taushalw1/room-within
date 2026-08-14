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

export const dateLong = (d: Date | string) =>
  format(new Date(d), "EEEE, d MMMM yyyy");

export const dateShort = (d: Date | string) => format(new Date(d), "d MMM yyyy");

export const timeOnly = (d: Date | string) => format(new Date(d), "h:mm a");

export const relative = (d: Date | string) =>
  formatDistanceToNowStrict(new Date(d), { addSuffix: true });

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
