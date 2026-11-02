import { addMonths, format, lastDayOfMonth } from "date-fns";

/**
 * What the next few months look like, if nothing changes.
 *
 * A forecast is only worth having if it is honest about which parts are
 * known and which are guessed, so the two are kept apart all the way to the
 * screen:
 *
 *   - Rent from active tenancies is known. It is a signed agreement with a
 *     figure and a date on it.
 *   - Invoices already raised are known.
 *   - Regular costs are an estimate, and a cautious one: only categories that
 *     actually turned up in most of the last six months count, at their
 *     median rather than their average, so one new roof doesn't become a
 *     monthly expectation.
 *
 * Anything else — a grant that might come, a room that might let — is left
 * out entirely. A forecast that includes hopes is a wish, and this one has to
 * be usable for deciding whether a bill can be paid.
 */

export type ForecastMonth = {
  month: string;
  label: string;
  rentCents: number;
  invoicedCents: number;
  membershipCents: number;
  inCents: number;
  regularCostsCents: number;
  outCents: number;
  netCents: number;
  /** Running balance from today's starting point. */
  balanceCents: number;
};

export type Forecast = {
  startingCents: number;
  months: ForecastMonth[];
  /** Categories counted as regular, with the figure used. */
  regular: { category: string; cents: number; seenInMonths: number }[];
  /** The first month the balance goes negative, if any. */
  shortfall: { month: string; label: string; cents: number } | null;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

/**
 * Which costs happen every month, and roughly how much.
 *
 * The test is how many of the last six months a category appeared in. Three
 * or more and it is treated as regular; fewer and it is left out of the
 * forecast altogether rather than smeared across it.
 */
export function regularCosts(
  expenses: { category: string; amount_cents: number; tax_cents: number; incurred_on: string }[],
  now = new Date(),
): { category: string; cents: number; seenInMonths: number }[] {
  const window: string[] = [];
  for (let i = 1; i <= 6; i++) {
    window.push(format(addMonths(now, -i), "yyyy-MM"));
  }

  const byCategory = new Map<string, Map<string, number>>();

  for (const e of expenses) {
    const month = e.incurred_on.slice(0, 7);
    if (!window.includes(month)) continue;
    const months = byCategory.get(e.category) ?? new Map<string, number>();
    months.set(month, (months.get(month) ?? 0) + e.amount_cents + e.tax_cents);
    byCategory.set(e.category, months);
  }

  return [...byCategory.entries()]
    .map(([category, months]) => ({
      category,
      cents: median([...months.values()]),
      seenInMonths: months.size,
    }))
    .filter((c) => c.seenInMonths >= 3 && c.cents > 0)
    .sort((a, b) => b.cents - a.cents);
}

export function buildForecast(args: {
  /** Money in the account today, as Tausha last told us. */
  startingCents: number;
  leases: { rent_cents: number; start_date: string; end_date: string | null }[];
  /** Raised and not yet paid. */
  openInvoices: { due_date: string; balance_cents: number }[];
  memberships: { monthly_cents: number }[];
  expenses: {
    category: string;
    amount_cents: number;
    tax_cents: number;
    incurred_on: string;
  }[];
  months?: number;
  now?: Date;
}): Forecast {
  const now = args.now ?? new Date();
  const horizon = args.months ?? 6;

  const regular = regularCosts(args.expenses, now);
  const regularTotal = regular.reduce((t, c) => t + c.cents, 0);
  const membershipTotal = args.memberships.reduce((t, m) => t + m.monthly_cents, 0);

  let balance = args.startingCents;
  const months: ForecastMonth[] = [];

  for (let i = 0; i < horizon; i++) {
    const when = addMonths(now, i);
    const key = format(when, "yyyy-MM");
    const monthEnd = format(lastDayOfMonth(when), "yyyy-MM-dd");
    const monthStart = `${key}-01`;

    // A tenancy only counts for months it is actually running. A lease that
    // ends in March should not be paying rent in April just because nobody
    // has replaced it yet — that is the whole thing this is meant to warn
    // about.
    const rentCents = args.leases
      .filter((l) => l.start_date <= monthEnd)
      .filter((l) => !l.end_date || l.end_date >= monthStart)
      .reduce((t, l) => t + l.rent_cents, 0);

    // Invoices already raised land in the month they are due. The current
    // month also carries everything overdue from before it, because that
    // money is either coming now or it is a problem now.
    const invoicedCents = args.openInvoices
      .filter((inv) =>
        i === 0 ? inv.due_date <= monthEnd : inv.due_date >= monthStart && inv.due_date <= monthEnd,
      )
      .reduce((t, inv) => t + inv.balance_cents, 0);

    // Rent for the current month is usually already invoiced, so counting
    // both would double it.
    const rentForMonth = i === 0 ? 0 : rentCents;

    const inCents = rentForMonth + invoicedCents + membershipTotal;
    const outCents = regularTotal;
    const netCents = inCents - outCents;
    balance += netCents;

    months.push({
      month: key,
      label: format(when, "MMMM yyyy"),
      rentCents: rentForMonth,
      invoicedCents,
      membershipCents: membershipTotal,
      inCents,
      regularCostsCents: regularTotal,
      outCents,
      netCents,
      balanceCents: balance,
    });
  }

  const short = months.find((m) => m.balanceCents < 0) ?? null;

  return {
    startingCents: args.startingCents,
    months,
    regular,
    shortfall: short
      ? { month: short.month, label: short.label, cents: short.balanceCents }
      : null,
  };
}
