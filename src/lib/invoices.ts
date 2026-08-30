import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Monthly rent invoicing.
 *
 * The generator runs daily rather than on the 1st, so a missed run self-heals
 * instead of skipping a month's rent entirely. That's only safe because a
 * partial unique index on (lease_id, period_start) makes a duplicate
 * impossible at the database level — see migration 0003.
 */

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** How far ahead of the due date an invoice is raised. */
const LEAD_DAYS = 10;

/**
 * The due date for a period, honouring the lease's due day.
 *
 * `due_day` is capped at 28 in the schema precisely so this can't fall off the
 * end of February.
 */
function dueDateFor(periodStart: Date, dueDay: number) {
  const d = new Date(periodStart);
  d.setDate(Math.min(dueDay, 28));
  return iso(d);
}

type Lease = {
  id: string;
  contact_id: string;
  unit_id: string;
  rent_cents: number;
  due_day: number;
  start_date: string;
  end_date: string | null;
  status: string;
};

/** Was this lease live during the given month? */
function leaseCoversPeriod(lease: Lease, periodStart: Date, periodEnd: Date) {
  if (new Date(lease.start_date) > periodEnd) return false;
  if (lease.end_date && new Date(lease.end_date) < periodStart) return false;
  return true;
}

export type GenerationResult = {
  created: number;
  skipped: number;
  periods: string[];
  errors: string[];
};

/**
 * Raise any missing rent invoices for the current month, and for next month
 * once we're within the lead time.
 *
 * Raising next month early matters: the reminder job sends a "coming up" note
 * three days before the due date, which can only fire if the invoice already
 * exists by then.
 */
export async function generateRentInvoices(
  supabase: SupabaseClient,
  today = new Date(),
): Promise<GenerationResult> {
  const result: GenerationResult = {
    created: 0,
    skipped: 0,
    periods: [],
    errors: [],
  };

  const periods = [startOfMonth(today)];
  const daysLeftInMonth = Math.ceil(
    (endOfMonth(today).getTime() - today.getTime()) / 86_400_000,
  );
  if (daysLeftInMonth <= LEAD_DAYS) periods.push(startOfMonth(addMonths(today, 1)));

  const { data: leases, error } = await supabase
    .from("leases")
    .select("id, contact_id, unit_id, rent_cents, due_day, start_date, end_date, status")
    .eq("status", "active");

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const { data: units } = await supabase.from("units").select("id, name");
  const unitName = new Map(
    ((units as { id: string; name: string }[]) ?? []).map((u) => [u.id, u.name]),
  );

  for (const periodStart of periods) {
    const periodEnd = endOfMonth(periodStart);
    result.periods.push(format(periodStart, "MMMM yyyy"));

    for (const lease of (leases as Lease[]) ?? []) {
      if (!leaseCoversPeriod(lease, periodStart, periodEnd)) {
        result.skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("invoices").insert({
        contact_id: lease.contact_id,
        lease_id: lease.id,
        kind: "rent",
        description: `${unitName.get(lease.unit_id) ?? "Rent"} — ${format(periodStart, "MMMM yyyy")}`,
        period_start: iso(periodStart),
        period_end: iso(periodEnd),
        issue_date: iso(today),
        due_date: dueDateFor(periodStart, lease.due_day),
        amount_cents: lease.rent_cents,
        tax_cents: 0,
        status: "sent",
      });

      if (!insertError) {
        result.created++;
      } else if (insertError.code === "23505") {
        // Unique violation — this month's invoice already exists. Expected on
        // every run after the first, and exactly why the index is there.
        result.skipped++;
      } else {
        result.errors.push(`${lease.id}: ${insertError.message}`);
      }
    }
  }

  return result;
}
