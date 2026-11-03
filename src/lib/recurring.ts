/**
 * Costs that come round again.
 *
 * The whole of the difficulty is in one function. Adding a month to the 31st
 * of January has no obvious right answer, and every library picks one; the
 * one picked here is the one a bill actually follows. An insurance payment
 * taken on the 31st is taken on the 28th in February and goes back to the
 * 31st in March — it does not permanently become the 28th, which is what a
 * naive "add a month" does and what would silently drift a yearly total by a
 * payment.
 */

export type Cadence = "monthly" | "quarterly" | "yearly";

const MONTHS: Record<Cadence, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * The next date after this one, keeping the day of the month where possible.
 *
 * `anchorDay` is the day the bill is really on — passed in separately because
 * once a date has been clamped to the 28th, the date itself no longer knows
 * it was meant to be the 31st. Callers that have the original should pass it;
 * those that don't get the behaviour of the date in hand.
 */
export function nextDue(
  from: string,
  cadence: Cadence,
  anchorDay?: number,
): string {
  const [y, m, d] = from.split("-").map(Number);
  const wanted = anchorDay ?? d;

  const total = m - 1 + MONTHS[cadence];
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;

  // The last day of the month we have landed in. Day 0 of the next month is
  // the last day of this one, which avoids a leap-year table.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(wanted, lastDay);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Every date a recurring cost falls on between two dates.
 *
 * Used by the forecast and by the page that offers to raise the next bill.
 * Bounded rather than open-ended: a yearly cost asked for over ten years is
 * ten rows, but a monthly one asked for over a careless span is hundreds, and
 * an unbounded loop driven by data is a page that hangs.
 */
export function occurrences(
  startFrom: string,
  cadence: Cadence,
  until: string,
  limit = 60,
): string[] {
  const anchorDay = Number(startFrom.split("-")[2]);
  const out: string[] = [];

  let cursor = startFrom;
  while (cursor <= until && out.length < limit) {
    out.push(cursor);
    cursor = nextDue(cursor, cadence, anchorDay);
  }

  return out;
}

/** What a recurring cost adds up to over a year, for comparing one to another. */
export function yearlyCents(amountCents: number, cadence: Cadence): number {
  return amountCents * (12 / MONTHS[cadence]);
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: "every month",
  quarterly: "every three months",
  yearly: "once a year",
};
