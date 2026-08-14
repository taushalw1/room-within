"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendInvoiceReminder } from "@/lib/email/send";
import { toCents } from "@/lib/format";

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

/* ---------------------------------------------------------------------------
   Adding a tenant
   --------------------------------------------------------------------------- */

const addTenantSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please give their name."),
    email: z
      .string()
      .trim()
      .email("That email address doesn't look right.")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    organisation: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),

    // Lease details — only required once a unit has been chosen.
    unitId: z.string().optional(),
    startDate: z.string().optional(),
    rent: z.string().optional(),
    deposit: z.string().optional(),
    dueDay: z.coerce.number().int().min(1).max(28).optional(),
  })
  .refine((v) => !v.unitId || Boolean(v.startDate), {
    message: "Choose the date the lease starts.",
  })
  .refine((v) => !v.unitId || Number(v.rent) > 0, {
    message: "Enter the monthly rent.",
  });

/**
 * Creates the person, and a lease if a unit was picked.
 *
 * A tenant is really two things — someone in the contact list, and an
 * agreement on a unit — so this does both in one step rather than making
 * Tausha create a person and then go and find them again.
 */
export async function addTenant(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = addTenantSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    organisation: formData.get("organisation"),
    notes: formData.get("notes"),
    unitId: formData.get("unitId") || undefined,
    startDate: formData.get("startDate") || undefined,
    rent: formData.get("rent") || undefined,
    deposit: formData.get("deposit") || undefined,
    dueDay: formData.get("dueDay") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  // Don't create a second record for someone already on file.
  let contactId: string | null = null;
  if (v.email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", v.email)
      .maybeSingle();
    contactId = (existing?.id as string) ?? null;
  }

  if (contactId) {
    await supabase
      .from("contacts")
      .update({
        phone: v.phone || null,
        organisation: v.organisation || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        full_name: v.fullName,
        email: v.email || null,
        phone: v.phone || null,
        organisation: v.organisation || null,
        notes: v.notes || null,
        tags: v.unitId ? ["tenant"] : [],
      })
      .select("id")
      .single();

    if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };
    contactId = created.id as string;
  }

  if (!v.unitId) {
    revalidatePath("/admin/contacts");
    return {
      ok: true,
      message: `${v.fullName} has been added to your people list.`,
    };
  }

  const { error: leaseError } = await supabase.from("leases").insert({
    unit_id: v.unitId,
    contact_id: contactId,
    start_date: v.startDate,
    rent_cents: toCents(v.rent ?? "0"),
    deposit_cents: toCents(v.deposit ?? "0"),
    due_day: v.dueDay ?? 1,
    status: "active",
  });

  if (leaseError) {
    return {
      ok: false,
      message: `${v.fullName} was saved, but the lease wasn't: ${leaseError.message}`,
    };
  }

  revalidatePath("/admin/rentals");
  revalidatePath("/admin/contacts");
  revalidatePath("/admin");

  return { ok: true, message: `${v.fullName} has been added as a tenant.` };
}
