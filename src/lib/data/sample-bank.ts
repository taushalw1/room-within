import type { KnownEntry } from "@/lib/reconcile";
import type { BankImportRow, BankLineRow } from "./types";

/**
 * A statement part-way through being ticked off, for the demo and for a clone
 * with no database behind it.
 *
 * Deliberately not tidy, and deliberately complete: between them these lines
 * produce every verdict the matcher can reach — one obvious answer, two
 * equally good answers, a near miss where a fee was taken, and a line nothing
 * explains at all. A sample that only shows the easy case teaches the wrong
 * thing about the page, and makes the hard cases impossible to look at without
 * a real database.
 */
export const sampleBankImports: BankImportRow[] = [
  {
    id: "1a000000-0000-4000-8000-000000000001",
    filename: "chequing-november.csv",
    period_start: "2026-11-01",
    period_end: "2026-11-24",
    line_count: 8,
    money_in_cents: 234_410,
    // 18,240 + 1,695 + 4,999 + 4,500 + 46,504
    money_out_cents: -75_938,
    reading: {
      dateOrder: "month-first",
      dateWasAmbiguous: false,
      amounts: "signed",
      columns: {
        date: "Transaction Date",
        description: "Description 1",
        amount: "CAD$",
      },
    },
    imported_by: null,
    imported_at: "2026-12-01T09:14:00Z",
  },
];

const base = {
  import_id: "1a000000-0000-4000-8000-000000000001",
  payment_id: null,
  expense_id: null,
  note: null,
  decided_by: null,
  decided_at: null,
  created_at: "2026-12-01T09:14:00Z",
};

export const sampleBankLines: BankLineRow[] = [
  /* --- already dealt with ------------------------------------------------ */
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000001",
    line_no: 2,
    occurred_on: "2026-11-01",
    description: "e-Transfer received, KEMP S",
    amount_cents: 120_000,
    status: "matched",
    payment_id: "pay-1",
    decided_at: "2026-12-01T09:20:00Z",
  },
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000002",
    line_no: 3,
    occurred_on: "2026-11-03",
    description: "MB-CREDIT MEMO",
    amount_cents: 95_000,
    status: "matched",
    payment_id: "pay-2",
    decided_at: "2026-12-01T09:21:00Z",
  },
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000003",
    line_no: 4,
    occurred_on: "2026-11-14",
    description: "FORTIS ALBERTA",
    amount_cents: -18_240,
    status: "added",
    expense_id: "exp-9",
    decided_at: "2026-12-01T09:23:00Z",
  },
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000004",
    line_no: 5,
    occurred_on: "2026-11-15",
    description: "MONTHLY ACCOUNT FEE",
    amount_cents: -1_695,
    status: "ignored",
    note: "Bank charge — goes in with the annual fees, not as a cost on its own.",
    decided_at: "2026-12-01T09:24:00Z",
  },

  /* --- still open, one of each kind -------------------------------------- */

  // Nothing on the books is anywhere near this. The reason the page exists.
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000005",
    line_no: 6,
    occurred_on: "2026-11-18",
    description: "PRE-AUTH DEBIT 884102",
    amount_cents: -4_999,
    status: "open",
  },
  // Stripe took its fee, so nothing matches to the cent.
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000006",
    line_no: 7,
    occurred_on: "2026-11-06",
    description: "STRIPE PAYOUT",
    amount_cents: 19_410,
    status: "open",
  },
  // Two costs of the same amount on the same day. A coin flip is not an answer.
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000007",
    line_no: 8,
    occurred_on: "2026-11-10",
    description: "POS PURCHASE 4410",
    amount_cents: -4_500,
    status: "open",
  },
  // Written on the 20th, cashed on the 24th. One obvious answer.
  {
    ...base,
    id: "b1000000-0000-4000-8000-000000000008",
    line_no: 9,
    occurred_on: "2026-11-24",
    description: "CHEQUE 101",
    amount_cents: -46_504,
    status: "open",
  },
];

/**
 * What the sample statement is matched against.
 *
 * The last one is on the books and absent from the statement, which is what
 * an uncashed cheque and a rent payment that never arrived both look like
 * from here — and the distinction she has to make herself.
 */
export const sampleKnownEntries: KnownEntry[] = [
  {
    kind: "expense",
    id: "e1000000-0000-4000-8000-000000000001",
    date: "2026-11-20",
    label: "Hildebrand Roofing",
    amountCents: -46_504,
  },
  {
    kind: "payment",
    id: "d1000000-0000-4000-8000-000000000001",
    date: "2026-11-05",
    label: "Hall booking — Fiddes anniversary",
    amountCents: 20_000,
  },
  {
    kind: "expense",
    id: "e1000000-0000-4000-8000-000000000002",
    date: "2026-11-10",
    label: "Grassy Lake Hardware",
    amountCents: -4_500,
  },
  {
    kind: "expense",
    id: "e1000000-0000-4000-8000-000000000003",
    date: "2026-11-10",
    label: "Paint for the stairwell",
    amountCents: -4_500,
  },
  {
    kind: "payment",
    id: "d1000000-0000-4000-8000-000000000002",
    date: "2026-11-27",
    label: "Rent — Daniel Reyes",
    amountCents: 85_000,
  },
];
