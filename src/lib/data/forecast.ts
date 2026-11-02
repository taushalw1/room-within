import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { buildForecast, type Forecast } from "@/lib/forecast";
import { getCashSettings } from "./settings";
import type { InvoiceRow, LeaseRow } from "./types";

/** The forecast, built from the real books. */
export async function getForecast(months = 6): Promise<Forecast> {
  const cash = await getCashSettings();

  if (isDemoMode) {
    const { sampleLeases, sampleInvoices, sampleExpenses } = await import("./sample-admin");
    return buildForecast({
      // Not a made-up starting figure: the demo should show the same
      // "counting from nothing" state a real account does before she
      // types one in.
      startingCents: cash.balance_cents,
      leases: sampleLeases.filter((l) => l.status === "active"),
      openInvoices: sampleInvoices
        .filter((i) => i.balance_cents > 0 && i.status !== "void")
        .map((i) => ({ due_date: i.due_date, balance_cents: i.balance_cents })),
      memberships: [],
      expenses: sampleExpenses,
      months,
    });
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return buildForecast({
      startingCents: cash.balance_cents,
      leases: [],
      openInvoices: [],
      memberships: [],
      expenses: [],
      months,
    });
  }

  const [leaseRes, invoiceRes, expenseRes, memberRes] = await Promise.all([
    supabase.from("leases").select("rent_cents, start_date, end_date").eq("status", "active"),
    supabase
      .from("invoice_balances")
      .select("due_date, balance_cents")
      .in("state", ["outstanding", "overdue"]),
    supabase.from("expenses").select("category, amount_cents, tax_cents, incurred_on"),
    supabase
      .from("memberships")
      .select("monthly_price_cents")
      .eq("status", "active"),
  ]);

  return buildForecast({
    startingCents: cash.balance_cents,
    leases: (leaseRes.data as Pick<LeaseRow, "rent_cents" | "start_date" | "end_date">[]) ?? [],
    openInvoices:
      (invoiceRes.data as Pick<InvoiceRow, "due_date" | "balance_cents">[]) ?? [],
    memberships: ((memberRes.data as { monthly_price_cents: number }[]) ?? []).map(
      (m) => ({ monthly_cents: m.monthly_price_cents }),
    ),
    expenses:
      (expenseRes.data as {
        category: string;
        amount_cents: number;
        tax_cents: number;
        incurred_on: string;
      }[]) ?? [],
    months,
  });
}
