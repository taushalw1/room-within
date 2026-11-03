import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { Rule } from "@/lib/bank-rules";
import {
  sampleBankRules,
  sampleBills,
  sampleRecurringCosts,
  sampleTrips,
} from "./sample-books";
import type {
  BankRuleRow,
  BillRow,
  InvoiceCreditRow,
  RecurringCostRow,
  TripRow,
} from "./types";

/** The CRA rate changes every year, so there is no sensible built-in default. */
export const MILEAGE_SETTING_KEY = "mileage_rate_cents_per_km";
export const LOCK_SETTING_KEY = "books_locked_before";

/* --- Bank rules ------------------------------------------------------------ */

export async function getBankRules(): Promise<BankRuleRow[]> {
  if (isDemoMode) return sampleBankRules;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("bank_rules")
    .select("*")
    .order("match_text");

  return (data as BankRuleRow[]) ?? [];
}

/** The shape the matcher wants, so the matcher never learns about the database. */
export function asRules(rows: BankRuleRow[]): Rule[] {
  return rows.map((r) => ({
    id: r.id,
    matchText: r.match_text,
    direction: r.direction,
    category: r.category,
    vendor: r.vendor,
  }));
}

/* --- Bills ----------------------------------------------------------------- */

export async function getBills(): Promise<BillRow[]> {
  if (isDemoMode) return sampleBills;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("bills")
    .select("*")
    .order("due_on", { ascending: true });

  return (data as BillRow[]) ?? [];
}

/**
 * What she owes, and how much of it is late.
 *
 * Void bills are left out of every total. A bill cancelled because it was
 * wrong should not go on appearing in what she owes, and the row is kept only
 * so that the cancellation itself is a record.
 */
export function billSummary(bills: BillRow[], today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  const open = bills.filter((b) => b.status === "open");

  const owed = open.reduce((sum, b) => sum + b.amount_cents + b.tax_cents, 0);
  const late = open.filter((b) => b.due_on < todayIso);
  const lateCents = late.reduce((sum, b) => sum + b.amount_cents + b.tax_cents, 0);

  return { open, owedCents: owed, late, lateCents };
}

/* --- Costs that repeat ------------------------------------------------------ */

export async function getRecurringCosts(): Promise<RecurringCostRow[]> {
  if (isDemoMode) return sampleRecurringCosts;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("recurring_costs")
    .select("*")
    .order("next_due", { ascending: true });

  return (data as RecurringCostRow[]) ?? [];
}

/* --- Mileage ---------------------------------------------------------------- */

export async function getTrips(year?: number): Promise<TripRow[]> {
  if (isDemoMode) {
    return year
      ? sampleTrips.filter((t) => t.travelled_on.startsWith(String(year)))
      : sampleTrips;
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("trips")
    .select("*")
    .order("travelled_on", { ascending: false });

  if (year) {
    query = query.gte("travelled_on", `${year}-01-01`).lte("travelled_on", `${year}-12-31`);
  }

  const { data } = await query;
  return (data as TripRow[]) ?? [];
}

/**
 * The per-kilometre rate she has set.
 *
 * Null rather than a guess. The CRA rate changes annually and asserting last
 * year's as though it were this year's would put a wrong number straight into
 * a tax figure — so the page asks for it instead, once a year.
 */
export async function getMileageRate(): Promise<number | null> {
  // Cents per kilometre, so 70 means 70c — not 7000. The demo had this
  // wrong by a factor of a hundred, which the generated column would
  // have turned into a trip priced at seventy dollars a kilometre.
  if (isDemoMode) return 70;

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", MILEAGE_SETTING_KEY)
    .maybeSingle();

  const value = (data as { value: { cents?: number } } | null)?.value;
  return typeof value?.cents === "number" && value.cents > 0 ? value.cents : null;
}

/* --- Closing a year --------------------------------------------------------- */

/** The date the books are closed up to, or null when nothing is closed. */
export async function getLockDate(): Promise<string | null> {
  if (isDemoMode) return "2025-12-31";

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", LOCK_SETTING_KEY)
    .maybeSingle();

  const value = (data as { value: { date?: string } } | null)?.value;
  return typeof value?.date === "string" ? value.date : null;
}

/* --- Credits ---------------------------------------------------------------- */

export async function getInvoiceCredits(
  invoiceId: string,
): Promise<InvoiceCreditRow[]> {
  if (isDemoMode) return [];

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("invoice_credits")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  return (data as InvoiceCreditRow[]) ?? [];
}

/**
 * Everybody with a login, and what they can see.
 *
 * Used by the settings panel that grants the accountant read-only access.
 * Names come from the contact where there is one, because a profile on its
 * own is a row with an email address and no person attached to it.
 */
export async function getPeopleWithLogins(): Promise<
  { profileId: string; name: string; email: string | null; role: string }[]
> {
  if (isDemoMode) {
    return [
      {
        profileId: "demo-admin",
        name: "Tausha (demo)",
        email: "demo@roomwithin.local",
        role: "admin",
      },
      {
        profileId: "d0000000-0000-4000-8000-000000000001",
        name: "Beverly Oyelaran, CPA",
        email: "beverly@example.ca",
        role: "member",
      },
    ];
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, role, email, contacts(full_name)");

  const rows =
    (data as unknown as {
      id: string;
      role: string;
      email: string | null;
      contacts: { full_name: string } | { full_name: string }[] | null;
    }[]) ?? [];

  return rows.map((p) => {
    // Supabase types an embedded relation as an array even where the foreign
    // key makes it at most one row.
    const contact = Array.isArray(p.contacts) ? p.contacts[0] : p.contacts;
    return {
      profileId: p.id,
      name: contact?.full_name ?? p.email ?? "Someone",
      email: p.email,
      role: p.role,
    };
  });
}
