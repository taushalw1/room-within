import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import {
  getDonations,
  getExpenses,
  getInstructorStatements,
  getInvoices,
} from "./admin";
import { getInstructors } from "./classes";
import type { YearEndInput } from "@/lib/year-end";

/**
 * Gather a year's worth of records for the accountant's pack.
 *
 * Income is taken from the payments ledger rather than from invoices, because
 * the pack is on a cash basis: an invoice raised in December and paid in
 * January belongs to January. Taking it from invoices would quietly produce
 * an accrual figure under a cash heading.
 *
 * GST collected is the exception — it is read from the invoices, since that
 * is where the tax was charged, but only from invoices that were actually
 * paid, and apportioned by how much of each was paid. A part-paid invoice has
 * not yet collected all of its tax.
 */
export async function getYearEndInput(year: number): Promise<YearEndInput> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [invoices, expenses, donations, statements, instructors] =
    await Promise.all([
      getInvoices(),
      getExpenses(),
      getDonations(),
      getInstructorStatements(),
      getInstructors(),
    ]);

  const payments = await getPaymentsBetween(from, to);

  // Tax collected, apportioned by how much of each invoice was actually paid.
  // An invoice half paid has collected half its GST, and treating it as all
  // or nothing is wrong in both directions.
  const gstCollectedCents = invoices
    .filter((i) => i.paid_cents > 0 && i.tax_cents > 0)
    .reduce((total, i) => {
      const gross = i.amount_cents + i.tax_cents;
      if (gross <= 0) return total;
      const share = Math.min(i.paid_cents / gross, 1);
      return total + Math.round(i.tax_cents * share);
    }, 0);

  const names = new Map(instructors.map((i) => [i.id, i.display_name]));

  const paidByInstructor = new Map<string, number>();
  for (const s of statements) {
    if (s.status !== "paid") continue;
    if (!s.paid_on || s.paid_on.slice(0, 4) !== String(year)) continue;
    paidByInstructor.set(
      s.instructor_id,
      (paidByInstructor.get(s.instructor_id) ?? 0) + s.net_payout_cents,
    );
  }

  return {
    year,
    payments,
    donations: donations.map((d) => ({
      amountCents: d.amount_cents,
      receivedAt: d.received_at,
    })),
    expenses: expenses.map((e) => ({
      amountCents: e.amount_cents,
      taxCents: e.tax_cents,
      incurredOn: e.incurred_on,
      category: e.category,
      vendor: e.vendor,
      description: e.description,
    })),
    gstCollectedCents,
    instructorPayouts: [...paidByInstructor.entries()].map(([id, paidCents]) => ({
      name: names.get(id) ?? "Someone",
      paidCents,
    })),
  };
}

/**
 * Payments received in a span, with the kind of thing they were for.
 *
 * The kind lives on the invoice rather than the payment, so it is read
 * through the join. A payment with no invoice behind it — a cash sum entered
 * directly — counts as "other" rather than being dropped.
 */
async function getPaymentsBetween(
  from: string,
  to: string,
): Promise<YearEndInput["payments"]> {
  // No payments ledger in the demo, so what was paid is read off the sample
  // invoices instead. Dated by the invoice rather than by when the money
  // actually came in, which is the one thing this page is careful about
  // everywhere else — acceptable only because there is nothing else to go on
  // and the alternative is a page that looks broken.
  if (isDemoMode) {
    const invoices = await getInvoices();
    return invoices
      .filter((i) => i.paid_cents > 0)
      .filter((i) => i.issue_date >= from && i.issue_date <= to)
      .map((i) => ({
        amountCents: i.paid_cents,
        paidAt: i.issue_date,
        kind: i.kind,
      }));
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("payments")
    .select("amount_cents, paid_at, invoices(kind)")
    .gte("paid_at", from)
    .lte("paid_at", `${to}T23:59:59`);

  const rows =
    (data as unknown as {
      amount_cents: number;
      paid_at: string;
      invoices: { kind: string } | { kind: string }[] | null;
    }[]) ?? [];

  return rows.map((p) => {
    // Supabase types an embedded relation as an array even where the foreign
    // key makes it at most one row.
    const invoice = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
    return {
      amountCents: p.amount_cents,
      paidAt: p.paid_at,
      kind: invoice?.kind ?? "other",
    };
  });
}

/** Which years there is anything to report on, newest first. */
export async function getYearsWithActivity(): Promise<number[]> {
  const [expenses, donations] = await Promise.all([getExpenses(), getDonations()]);

  const years = new Set<number>([new Date().getFullYear()]);
  for (const e of expenses) years.add(Number(e.incurred_on.slice(0, 4)));
  for (const d of donations) years.add(Number(d.received_at.slice(0, 4)));

  return [...years].filter((y) => y > 2000).sort((a, b) => b - a);
}
