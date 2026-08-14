"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendInvoiceReminder } from "@/lib/email/send";

export type ActionResult = { ok: boolean; message: string };

const DEMO_RESULT: ActionResult = {
  ok: false,
  message:
    "This is demo mode, so nothing was saved. Connect the database to record real payments.",
};

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  contactId: z.string().uuid(),
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  method: z.enum(["etransfer", "cash", "cheque", "stripe", "other"]),
  reference: z.string().max(120).optional().nullable(),
});

/** Mark money as received against an invoice. */
export async function recordPayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    contactId: formData.get("contactId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { invoiceId, contactId, amount, method, reference } = parsed.data;

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    contact_id: contactId,
    amount_cents: Math.round(amount * 100),
    method,
    reference: reference || null,
  });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  // If the invoice is now settled, close it off.
  const { data: balance } = await supabase
    .from("invoice_balances")
    .select("balance_cents")
    .eq("id", invoiceId)
    .single();

  if (balance && (balance.balance_cents as number) <= 0) {
    await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
  }

  revalidatePath("/admin/rentals");
  revalidatePath("/admin");
  return { ok: true, message: "Payment recorded." };
}

/** Send the overdue reminder email straight away, rather than waiting for the daily job. */
export async function sendReminderNow(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { ok: false, message: "Missing invoice." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { data: invoice } = await supabase
    .from("invoice_balances")
    .select("*, contacts:contact_id (full_name, email)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { ok: false, message: "Couldn't find that invoice." };

  const contact = invoice.contacts as { full_name: string; email: string | null };
  if (!contact?.email) {
    return { ok: false, message: "That person has no email address on file." };
  }

  const result = await sendInvoiceReminder({
    to: contact.email,
    name: contact.full_name,
    invoiceNumber: (invoice.number as string) ?? "",
    description: (invoice.description as string) ?? "Amount owing",
    dueDate: invoice.due_date as string,
    balanceCents: invoice.balance_cents as number,
    daysOverdue: invoice.days_overdue as number,
  });

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/rentals");
  return { ok: true, message: `Reminder sent to ${contact.email}.` };
}
