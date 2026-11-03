import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { KnownEntry } from "@/lib/reconcile";
import {
  sampleBankImports,
  sampleBankLines,
  sampleKnownEntries,
} from "./sample-bank";
import type { BankImportRow, BankLineRow, ContactRow, ExpenseRow } from "./types";

/**
 * Reads for ticking the books off against the bank.
 *
 * The interesting one is `getKnownEntries`, which gathers everything a
 * statement line could possibly be — every payment in, every cost out — and
 * marks the ones already accounted for on some earlier statement. Marking them
 * rather than leaving them out matters: a record that has already been ticked
 * off should still be visible as a near miss when a second statement line has
 * almost the same amount, because that pair is usually a duplicate and seeing
 * it is the point.
 */

export async function getBankImports(): Promise<BankImportRow[]> {
  if (isDemoMode) return sampleBankImports;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("bank_imports")
    .select("*")
    .order("imported_at", { ascending: false });

  return (data as BankImportRow[]) ?? [];
}

export async function getBankImport(
  id: string,
): Promise<{ statement: BankImportRow; lines: BankLineRow[] } | null> {
  if (isDemoMode) {
    const statement = sampleBankImports.find((s) => s.id === id);
    if (!statement) return null;
    return {
      statement,
      lines: sampleBankLines.filter((l) => l.import_id === id),
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const [{ data: statement }, { data: lines }] = await Promise.all([
    supabase.from("bank_imports").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bank_lines")
      .select("*")
      .eq("import_id", id)
      .order("line_no", { ascending: true }),
  ]);

  if (!statement) return null;

  return {
    statement: statement as BankImportRow,
    lines: (lines as BankLineRow[]) ?? [],
  };
}

/** Every statement line still waiting for a decision, oldest first. */
export async function getOpenBankLines(): Promise<BankLineRow[]> {
  // Sorted here as well as in the query: the page shows the oldest one
  // waiting, and sample data in file order quietly reports the wrong date.
  if (isDemoMode) {
    return sampleBankLines
      .filter((l) => l.status === "open")
      .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  }
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("bank_lines")
    .select("*")
    .eq("status", "open")
    .order("occurred_on", { ascending: true });

  return (data as BankLineRow[]) ?? [];
}

/**
 * Everything a statement line could turn out to be, over a span of dates.
 *
 * The span is widened at both ends by the matching window, because a payment
 * recorded on the 28th can appear on a statement that starts on the 1st and a
 * statement line is allowed to be a few days away from the record it belongs
 * to. Querying only the statement's own dates loses exactly the matches that
 * are hardest to make by hand.
 */
export async function getKnownEntries(
  from: string,
  to: string,
): Promise<KnownEntry[]> {
  const widen = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const start = widen(from, -10);
  const end = widen(to, 10);

  if (isDemoMode) return sampleKnownEntries;

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const [{ data: payments }, { data: expenses }, { data: contacts }, { data: settled }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("id, contact_id, amount_cents, paid_at, method, reference")
        .gte("paid_at", start)
        .lte("paid_at", `${end}T23:59:59`),
      supabase
        .from("expenses")
        .select("id, vendor, category, description, amount_cents, incurred_on")
        .gte("incurred_on", start)
        .lte("incurred_on", end),
      supabase.from("contacts").select("id, full_name"),
      supabase
        .from("bank_lines")
        .select("payment_id, expense_id")
        .or("payment_id.not.is.null,expense_id.not.is.null"),
    ]);

  const names = new Map(
    ((contacts as Pick<ContactRow, "id" | "full_name">[]) ?? []).map((c) => [
      c.id,
      c.full_name,
    ]),
  );

  const takenPayments = new Set(
    ((settled as { payment_id: string | null }[]) ?? [])
      .map((r) => r.payment_id)
      .filter((id): id is string => id !== null),
  );
  const takenExpenses = new Set(
    ((settled as { expense_id: string | null }[]) ?? [])
      .map((r) => r.expense_id)
      .filter((id): id is string => id !== null),
  );

  const paymentEntries: KnownEntry[] = (
    (payments as {
      id: string;
      contact_id: string;
      amount_cents: number;
      paid_at: string;
      method: string | null;
      reference: string | null;
    }[]) ?? []
  ).map((p) => ({
    kind: "payment" as const,
    id: p.id,
    date: p.paid_at.slice(0, 10),
    label: [names.get(p.contact_id) ?? "Someone", p.reference]
      .filter(Boolean)
      .join(" — "),
    // Money she received, so positive, the same way round as a bank credit.
    amountCents: Math.abs(p.amount_cents),
    settled: takenPayments.has(p.id),
  }));

  const expenseEntries: KnownEntry[] = (
    (expenses as Pick<
      ExpenseRow,
      "id" | "vendor" | "category" | "description" | "amount_cents" | "incurred_on"
    >[]) ?? []
  ).map((e) => ({
    kind: "expense" as const,
    id: e.id,
    date: e.incurred_on,
    label: e.vendor || e.description || e.category,
    // A cost is money leaving, so negative — expenses are stored as a positive
    // amount and the sign is what tells the matcher which way it went.
    amountCents: -Math.abs(e.amount_cents),
    settled: takenExpenses.has(e.id),
  }));

  return [...paymentEntries, ...expenseEntries];
}
