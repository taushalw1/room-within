import type { SupabaseClient } from "@supabase/supabase-js";
import { getLateFeeSettings, lateFeeFor } from "@/lib/data/settings";
import type { InvoiceRow } from "@/lib/data/types";

/**
 * Charge late fees on invoices that have gone past their grace period.
 *
 * Three rules, and all three are about not being the kind of landlord who
 * compounds a bad month into a worse one:
 *
 *   - Off unless Tausha has turned it on. Nothing here runs by default.
 *   - Once per invoice, ever. Not monthly on the same debt — the log's
 *     primary key is what guarantees that, not the check below it.
 *   - Never more than the debt itself, and never past the ceiling.
 *
 * The fee becomes its own invoice rather than being added to the original,
 * so the tenant can see exactly what it is and what it was for, and so it
 * flows through the reminders and payments that already exist.
 */
export async function applyLateFees(
  supabase: SupabaseClient,
  today = new Date(),
): Promise<{ charged: number; total_cents: number; skipped: number }> {
  const settings = await getLateFeeSettings();
  if (!settings.enabled) return { charged: 0, total_cents: 0, skipped: 0 };

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - settings.grace_days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("invoice_balances")
    .select("*")
    .in("state", ["overdue"])
    .lte("due_date", cutoffDate);

  const invoices = (data as InvoiceRow[]) ?? [];
  if (invoices.length === 0) return { charged: 0, total_cents: 0, skipped: 0 };

  const { data: already } = await supabase
    .from("late_fee_log")
    .select("invoice_id")
    .in(
      "invoice_id",
      invoices.map((i) => i.id),
    );

  const done = new Set(
    ((already as { invoice_id: string }[]) ?? []).map((r) => r.invoice_id),
  );

  let charged = 0;
  let total = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    if (done.has(invoice.id)) {
      skipped++;
      continue;
    }

    const fee = lateFeeFor(settings, invoice);
    if (fee <= 0) {
      skipped++;
      continue;
    }

    const { data: feeInvoice, error } = await supabase
      .from("invoices")
      .insert({
        contact_id: invoice.contact_id,
        lease_id: invoice.lease_id,
        kind: "other",
        description: `Late fee — invoice ${invoice.number ?? ""}`.trim(),
        issue_date: today.toISOString().slice(0, 10),
        due_date: today.toISOString().slice(0, 10),
        amount_cents: fee,
        tax_cents: 0,
        status: "sent",
      })
      .select("id")
      .single();

    if (error) {
      skipped++;
      continue;
    }

    // Written after the fee invoice exists, so a failure half way through
    // leaves a charge that is visible rather than one that is invisible and
    // about to be charged again tomorrow.
    const { error: logError } = await supabase.from("late_fee_log").insert({
      invoice_id: invoice.id,
      fee_invoice_id: (feeInvoice as { id: string }).id,
      amount_cents: fee,
    });

    if (logError) {
      // Something else charged it between the read and now. Take the fee
      // invoice back out rather than leaving a double charge.
      await supabase
        .from("invoices")
        .delete()
        .eq("id", (feeInvoice as { id: string }).id);
      skipped++;
      continue;
    }

    charged++;
    total += fee;
  }

  return { charged, total_cents: total, skipped };
}
