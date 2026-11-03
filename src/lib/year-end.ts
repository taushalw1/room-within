/**
 * The figures an accountant asks for, and the file to hand them.
 *
 * Reported on a **cash** basis: money that actually arrived and actually left
 * inside the year, not invoices raised or costs incurred. That is stated on
 * the page in as many words, because the two bases give different numbers and
 * a figure whose basis is unstated is a figure somebody will file wrongly.
 * Cash is also the basis she can check — it is what the bank statement says,
 * which is now something the app can tick off against.
 *
 * Everything here is assembly and arithmetic over rows that already exist.
 * Nothing is estimated, nothing is apportioned, and there is no depreciation
 * or capital cost allowance — those need judgement about assets and lifetimes
 * that this app has no business making. The page says so rather than quietly
 * producing a number that looks like a tax figure and isn't.
 */

export type YearEndInput = {
  year: number;
  /** Money received, from the payments ledger. */
  payments: { amountCents: number; paidAt: string; kind: string | null }[];
  donations: { amountCents: number; receivedAt: string }[];
  expenses: {
    amountCents: number;
    taxCents: number;
    incurredOn: string;
    category: string;
    vendor: string | null;
    description: string | null;
  }[];
  /** Tax charged on invoices that were actually paid inside the year. */
  gstCollectedCents: number;
  instructorPayouts: { name: string; paidCents: number }[];
};

export type YearEnd = {
  year: number;
  income: {
    byStream: { label: string; cents: number }[];
    donationsCents: number;
    totalCents: number;
  };
  costs: {
    byCategory: { label: string; cents: number; taxCents: number }[];
    totalCents: number;
  };
  gst: {
    collectedCents: number;
    paidCents: number;
    /** What would be remitted, if she is registered. Negative means a refund. */
    netCents: number;
    /** Registration becomes compulsory above this in a year. */
    thresholdCents: number;
    overThreshold: boolean;
  };
  t4a: { name: string; paidCents: number; needed: boolean }[];
  netCents: number;
};

/** A T4A is required for anyone paid more than this in a calendar year. */
export const T4A_THRESHOLD_CENTS = 50_000;

/** GST registration becomes compulsory above this in a year. */
export const GST_THRESHOLD_CENTS = 3_000_000;

const STREAM_LABELS: Record<string, string> = {
  rent: "Rent",
  booking: "Room bookings",
  counselling: "Counselling",
  deposit: "Deposits",
  classes: "Classes",
  other: "Other",
};

function inYear(date: string, year: number): boolean {
  return date.slice(0, 4) === String(year);
}

function sum<T>(rows: T[], of: (row: T) => number): number {
  return rows.reduce((total, row) => total + of(row), 0);
}

export function buildYearEnd(input: YearEndInput): YearEnd {
  const { year } = input;

  const payments = input.payments.filter((p) => inYear(p.paidAt, year));
  const donations = input.donations.filter((d) => inYear(d.receivedAt, year));
  const expenses = input.expenses.filter((e) => inYear(e.incurredOn, year));

  // --- Income -------------------------------------------------------------

  const streams = new Map<string, number>();
  for (const p of payments) {
    const key = p.kind ?? "other";
    streams.set(key, (streams.get(key) ?? 0) + p.amountCents);
  }

  const byStream = [...streams.entries()]
    .map(([key, cents]) => ({ label: STREAM_LABELS[key] ?? key, cents }))
    .sort((a, b) => b.cents - a.cents);

  const donationsCents = sum(donations, (d) => d.amountCents);
  const incomeTotal = sum(payments, (p) => p.amountCents) + donationsCents;

  // --- Costs --------------------------------------------------------------

  const categories = new Map<string, { cents: number; taxCents: number }>();
  for (const e of expenses) {
    const found = categories.get(e.category) ?? { cents: 0, taxCents: 0 };
    found.cents += e.amountCents;
    found.taxCents += e.taxCents;
    categories.set(e.category, found);
  }

  const byCategory = [...categories.entries()]
    .map(([label, v]) => ({ label, cents: v.cents, taxCents: v.taxCents }))
    .sort((a, b) => b.cents - a.cents);

  const costsTotal = sum(expenses, (e) => e.amountCents);

  // --- GST ----------------------------------------------------------------

  const gstPaid = sum(expenses, (e) => e.taxCents);

  // --- T4A ----------------------------------------------------------------

  const t4a = input.instructorPayouts
    .map((i) => ({
      name: i.name,
      paidCents: i.paidCents,
      needed: i.paidCents > T4A_THRESHOLD_CENTS,
    }))
    .sort((a, b) => b.paidCents - a.paidCents);

  return {
    year,
    income: { byStream, donationsCents, totalCents: incomeTotal },
    costs: { byCategory, totalCents: costsTotal },
    gst: {
      collectedCents: input.gstCollectedCents,
      paidCents: gstPaid,
      netCents: input.gstCollectedCents - gstPaid,
      thresholdCents: GST_THRESHOLD_CENTS,
      overThreshold: incomeTotal >= GST_THRESHOLD_CENTS,
    },
    t4a,
    netCents: incomeTotal - costsTotal,
  };
}

/* -------------------------------------------------------------------------- */
/*  The file to hand over                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One cell of CSV, quoted when it needs to be.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with an apostrophe. Spreadsheets
 * treat those as the start of a formula, so a vendor who has called themselves
 * "+1 Plumbing" becomes an error in the accountant's spreadsheet at best, and
 * at worst something that runs. The apostrophe is the documented way to say
 * "this is text".
 */
function cell(value: string | number): string {
  const text = String(value ?? "");

  // A plain number is never a formula, and must not be guarded: every cost in
  // this file is negative, and an apostrophe in front of one turns the whole
  // Amount column into text that will not add up. Which is the one thing an
  // accountant is certain to do with it.
  const isNumber = /^-?\d+(\.\d+)?$/.test(text);
  const guarded = !isNumber && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function rows(lines: (string | number)[][]): string {
  // CRLF: what every spreadsheet expects, and what Excel needs to not treat
  // the whole file as one line.
  return lines.map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Money as a plain decimal, for a spreadsheet rather than for reading. */
function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Every transaction of the year, one per line.
 *
 * This is the file that actually matters. The summary is a convenience; the
 * transaction list is what an accountant will want to re-add themselves, and
 * being able to hand it over is the difference between an afternoon and a
 * shoebox.
 */
export function transactionsCsv(input: YearEndInput): string {
  const { year } = input;

  const lines: (string | number)[][] = [
    ["Date", "Type", "Category", "Who", "Description", "Amount", "GST included"],
  ];

  for (const p of input.payments.filter((x) => inYear(x.paidAt, year))) {
    lines.push([
      p.paidAt.slice(0, 10),
      "Income",
      STREAM_LABELS[p.kind ?? "other"] ?? p.kind ?? "Other",
      "",
      "",
      dollars(p.amountCents),
      "",
    ]);
  }

  for (const d of input.donations.filter((x) => inYear(x.receivedAt, year))) {
    lines.push([
      d.receivedAt.slice(0, 10),
      "Income",
      "Donations",
      "",
      "",
      dollars(d.amountCents),
      "",
    ]);
  }

  for (const e of input.expenses.filter((x) => inYear(x.incurredOn, year))) {
    lines.push([
      e.incurredOn,
      "Cost",
      e.category,
      e.vendor ?? "",
      e.description ?? "",
      // Negative, so the column sums to the actual position rather than
      // needing the reader to know which rows to subtract.
      dollars(-e.amountCents),
      dollars(e.taxCents),
    ]);
  }

  // Sorted by date across both kinds, which is how a statement reads and how
  // anybody checking it against the bank will want it.
  const [header, ...body] = lines;
  body.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return rows([header, ...body]);
}

/** The summary, as a second sheet rather than a second format. */
export function summaryCsv(result: YearEnd): string {
  const lines: (string | number)[][] = [
    [`Room Within Community — ${result.year}`],
    ["Prepared on a cash basis: money received and money paid within the year."],
    [],
    ["INCOME"],
    ...result.income.byStream.map((s) => [s.label, dollars(s.cents)]),
    ["Donations", dollars(result.income.donationsCents)],
    ["Total income", dollars(result.income.totalCents)],
    [],
    ["COSTS"],
    ["Category", "Amount", "GST included"],
    ...result.costs.byCategory.map((c) => [
      c.label,
      dollars(c.cents),
      dollars(c.taxCents),
    ]),
    ["Total costs", dollars(result.costs.totalCents)],
    [],
    ["Income less costs", dollars(result.netCents)],
    [],
    ["GST"],
    ["Collected on paid invoices", dollars(result.gst.collectedCents)],
    ["Paid on costs", dollars(result.gst.paidCents)],
    ["Difference", dollars(result.gst.netCents)],
    [],
    ["PAID TO INSTRUCTORS"],
    ["Name", "Paid", "T4A needed"],
    ...result.t4a.map((t) => [t.name, dollars(t.paidCents), t.needed ? "yes" : "no"]),
    [],
    ["This is a management summary, not a tax return. It does not include"],
    ["depreciation, capital cost allowance, accruals, or anything requiring"],
    ["judgement about assets. Give your accountant the transaction list too."],
  ];

  return rows(lines);
}
