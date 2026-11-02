import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceRow } from "@/lib/data/types";

/**
 * A statement of account: everything charged and everything paid, in order,
 * with a running balance.
 *
 * The thing this replaces is a phone call that starts "I thought I'd paid
 * that". A running balance down the page answers it without anybody having to
 * reconstruct the year from memory, and it is the same document whether she
 * sends it to a tenant, to an accountant, or reads it herself.
 */

export type StatementEntry = {
  date: string;
  kind: "charge" | "payment";
  reference: string | null;
  description: string;
  /** Positive for a charge, negative for a payment. */
  amount_cents: number;
  balance_cents: number;
};

export type Statement = {
  name: string;
  from: string;
  to: string;
  entries: StatementEntry[];
  chargedCents: number;
  paidCents: number;
  balanceCents: number;
  /** The part of the balance that is already past its due date. */
  overdueCents: number;
};

export function buildStatement(args: {
  name: string;
  from: string;
  to: string;
  invoices: InvoiceRow[];
  payments: {
    id: string;
    invoice_id: string | null;
    amount_cents: number;
    paid_at: string;
    method: string | null;
  }[];
  today?: Date;
}): Statement {
  const today = args.today ?? new Date();
  const within = (d: string) => d >= args.from && d <= args.to;

  const numbers = new Map(args.invoices.map((i) => [i.id, i.number]));

  const rows: Omit<StatementEntry, "balance_cents">[] = [
    ...args.invoices
      .filter((i) => i.status !== "void" && within(i.issue_date))
      .map((i) => ({
        date: i.issue_date,
        kind: "charge" as const,
        reference: i.number,
        description: i.description ?? i.kind,
        amount_cents: i.amount_cents + i.tax_cents,
      })),
    ...args.payments
      .filter((p) => within(p.paid_at.slice(0, 10)))
      .map((p) => ({
        date: p.paid_at.slice(0, 10),
        kind: "payment" as const,
        reference: p.invoice_id ? (numbers.get(p.invoice_id) ?? null) : null,
        description: p.method ? `Payment — ${p.method}` : "Payment",
        amount_cents: -p.amount_cents,
      })),
  ].sort((a, b) =>
    // Charges before payments on the same day, so a bill paid the day it was
    // raised reads as it happened rather than showing a negative balance.
    a.date === b.date ? a.amount_cents > b.amount_cents ? -1 : 1 : a.date < b.date ? -1 : 1,
  );

  let running = 0;
  const entries: StatementEntry[] = rows.map((r) => {
    running += r.amount_cents;
    return { ...r, balance_cents: running };
  });

  const charged = rows
    .filter((r) => r.kind === "charge")
    .reduce((t, r) => t + r.amount_cents, 0);
  const paid = -rows
    .filter((r) => r.kind === "payment")
    .reduce((t, r) => t + r.amount_cents, 0);

  const todayStr = today.toISOString().slice(0, 10);
  const overdue = args.invoices
    .filter((i) => i.due_date < todayStr && i.balance_cents > 0 && i.status !== "void")
    .reduce((t, i) => t + i.balance_cents, 0);

  return {
    name: args.name,
    from: args.from,
    to: args.to,
    entries,
    chargedCents: charged,
    paidCents: paid,
    balanceCents: running,
    overdueCents: overdue,
  };
}

/* --- The printable version ------------------------------------------------- */

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const OLIVE = rgb(0.369, 0.431, 0.271);
const INK = rgb(0.227, 0.216, 0.184);
const SOFT = rgb(0.42, 0.4, 0.35);
const BURGUNDY = rgb(0.486, 0.18, 0.243);

/**
 * Make a string safe for a PDF standard font.
 *
 * The built-in fonts can only encode WinAnsi, and anything outside it throws
 * rather than dropping — so one curly apostrophe in a tenant's name would
 * fail the whole statement. The nice characters are swapped for their plain
 * equivalents, and anything still out of range is removed rather than allowed
 * to take the document down.
 */
function safe(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‒–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^ -ÿ]/g, "");
}

const money = (cents: number) =>
  `$${(Math.abs(cents) / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * The same statement as a PDF she can attach to an email.
 *
 * Laid out as columns rather than prose because this one is meant to be
 * checked against somebody else's records, and a column of figures is what
 * makes that possible.
 */
export async function buildStatementPdf(
  statement: Statement,
  businessName: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const COLS = { date: MARGIN, desc: MARGIN + 70, amount: 400, balance: 480 };

  const header = () => {
    page.drawText(safe(businessName), { x: MARGIN, y, size: 10, font: bold, color: OLIVE });
    y -= 26;
    page.drawText("Statement of account", {
      x: MARGIN,
      y,
      size: 19,
      font: bold,
      color: INK,
    });
    y -= 20;
    page.drawText(safe(statement.name), { x: MARGIN, y, size: 12, font: regular, color: INK });
    y -= 14;
    page.drawText(safe(`${statement.from} to ${statement.to}`), {
      x: MARGIN,
      y,
      size: 10,
      font: regular,
      color: SOFT,
    });
    y -= 26;
  };

  const columnHeads = () => {
    for (const [label, x] of [
      ["Date", COLS.date],
      ["What for", COLS.desc],
      ["Amount", COLS.amount],
      ["Balance", COLS.balance],
    ] as const) {
      page.drawText(safe(label), { x, y, size: 8, font: bold, color: SOFT });
    }
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.78, 0.74, 0.66),
    });
    y -= 14;
  };

  header();
  columnHeads();

  const truncate = (text: string, width: number) => {
    let out = safe(text);
    while (out.length > 4 && regular.widthOfTextAtSize(out, 9) > width) {
      out = out.slice(0, -1);
    }
    return out === safe(text) ? out : `${out.trimEnd()}...`;
  };

  for (const entry of statement.entries) {
    if (y < MARGIN + 60) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
      columnHeads();
    }

    const label = entry.reference
      ? `${entry.description} (${entry.reference})`
      : entry.description;

    page.drawText(entry.date, { x: COLS.date, y, size: 9, font: regular, color: SOFT });
    page.drawText(truncate(label, COLS.amount - COLS.desc - 10), {
      x: COLS.desc,
      y,
      size: 9,
      font: regular,
      color: INK,
    });
    page.drawText(
      `${entry.kind === "payment" ? "-" : ""}${money(entry.amount_cents)}`,
      {
        x: COLS.amount,
        y,
        size: 9,
        font: regular,
        color: entry.kind === "payment" ? OLIVE : INK,
      },
    );
    page.drawText(money(entry.balance_cents), {
      x: COLS.balance,
      y,
      size: 9,
      font: regular,
      color: INK,
    });

    y -= 15;
  }

  if (statement.entries.length === 0) {
    page.drawText("Nothing charged or paid in this period.", {
      x: MARGIN,
      y,
      size: 10,
      font: regular,
      color: SOFT,
    });
    y -= 20;
  }

  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.78, 0.74, 0.66),
  });
  y -= 20;

  const total = (label: string, value: string, strong = false) => {
    page.drawText(safe(label), {
      x: COLS.amount - 120,
      y,
      size: strong ? 11 : 9,
      font: strong ? bold : regular,
      color: strong ? INK : SOFT,
    });
    page.drawText(value, {
      x: COLS.balance,
      y,
      size: strong ? 11 : 9,
      font: strong ? bold : regular,
      color: INK,
    });
    y -= strong ? 20 : 15;
  };

  total("Charged in this period", money(statement.chargedCents));
  total("Paid in this period", money(statement.paidCents));
  total("Balance", money(statement.balanceCents), true);

  if (statement.overdueCents > 0) {
    page.drawText(
      safe(`${money(statement.overdueCents)} of this is already past its due date.`),
      { x: MARGIN, y, size: 10, font: bold, color: BURGUNDY },
    );
    y -= 20;
  }

  // Said on every statement, not only when somebody asks. A person who is
  // struggling will usually say nothing unless they are invited to.
  page.drawText(
    "If paying is difficult just now, please say so - we would rather know.",
    { x: MARGIN, y: MARGIN - 10, size: 9, font: regular, color: SOFT },
  );

  return pdf.save();
}
