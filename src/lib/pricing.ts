import type { RoomRow } from "@/lib/data/types";
import { hoursBetween } from "@/lib/format";

export const GST_RATE = 0.05;

export type Quote = {
  hours: number;
  basis: "hourly" | "half day" | "full day";
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

/**
 * What a booking costs.
 *
 * Half-day and full-day rates are applied whenever they work out cheaper than
 * the hourly rate — a five-hour booking should never cost more than the
 * half-day price just because the person didn't know to ask.
 */
export function quoteBooking(
  room: Pick<
    RoomRow,
    "hourly_rate_cents" | "half_day_rate_cents" | "full_day_rate_cents" | "min_hours"
  >,
  start: Date | string,
  end: Date | string,
): Quote {
  const rawHours = hoursBetween(start, end);
  const hours = Math.max(rawHours, room.min_hours ?? 0);

  const options: { basis: Quote["basis"]; cents: number }[] = [
    { basis: "hourly", cents: Math.round(room.hourly_rate_cents * hours) },
  ];

  if (room.half_day_rate_cents && hours <= 4.5) {
    options.push({ basis: "half day", cents: room.half_day_rate_cents });
  }
  if (room.full_day_rate_cents) {
    options.push({ basis: "full day", cents: room.full_day_rate_cents });
  }

  const best = options.reduce((a, b) => (b.cents < a.cents ? b : a));
  const taxCents = Math.round(best.cents * GST_RATE);

  return {
    hours: rawHours,
    basis: best.basis,
    subtotalCents: best.cents,
    taxCents,
    totalCents: best.cents + taxCents,
  };
}
