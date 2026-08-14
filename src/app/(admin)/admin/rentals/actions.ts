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

/* ---------------------------------------------------------------------------
   Editing and removing people
   --------------------------------------------------------------------------- */

function revalidatePeopleViews() {
  revalidatePath("/admin/rentals");
  revalidatePath("/admin/contacts");
  revalidatePath("/admin");
}

const updateContactSchema = z.object({
  contactId: z.string().min(1),
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
});

export async function updateContact(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = updateContactSchema.safeParse({
    contactId: formData.get("contactId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    organisation: formData.get("organisation"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: v.fullName,
      email: v.email || null,
      phone: v.phone || null,
      organisation: v.organisation || null,
      notes: v.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", v.contactId);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePeopleViews();
  return { ok: true, message: "Changes saved." };
}

/**
 * Remove someone entirely.
 *
 * Only possible for a person with no history. Leases, invoices and payments
 * all reference contacts with ON DELETE RESTRICT, so the database would refuse
 * anyway — but a raw Postgres foreign-key error is no use to Tausha, so the
 * dependencies are counted first and explained in plain language.
 *
 * Deleting the record of someone who has paid you money would also destroy the
 * financial history those payments belong to. Ending their tenancy is almost
 * always what's actually wanted.
 */
export async function deleteContact(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing person." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const counted = async (table: string) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("contact_id", id);
    return count ?? 0;
  };

  const [leases, invoices, payments, bookings, appointments] = await Promise.all([
    counted("leases"),
    counted("invoices"),
    counted("payments"),
    counted("bookings"),
    counted("counselling_appointments"),
  ]);

  const blockers: string[] = [];
  if (leases) blockers.push(`${leases} lease${leases === 1 ? "" : "s"}`);
  if (invoices) blockers.push(`${invoices} invoice${invoices === 1 ? "" : "s"}`);
  if (payments) blockers.push(`${payments} payment${payments === 1 ? "" : "s"}`);
  if (appointments) {
    blockers.push(`${appointments} counselling session${appointments === 1 ? "" : "s"}`);
  }

  if (blockers.length > 0) {
    return {
      ok: false,
      message:
        `Can't delete them — they have ${blockers.join(", ")} on record, and ` +
        `removing the person would take that history with them. End their ` +
        `tenancy instead if they've moved on.`,
    };
  }

  // Bookings keep a name and email of their own, so they survive the contact
  // being removed — worth saying so rather than silently detaching them.
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, message: `Couldn't delete that: ${error.message}` };

  revalidatePeopleViews();
  return {
    ok: true,
    message: bookings
      ? `Deleted. Their ${bookings} past booking${bookings === 1 ? "" : "s"} stayed in the diary.`
      : "Deleted.",
  };
}

/* ---------------------------------------------------------------------------
   Editing and ending leases
   --------------------------------------------------------------------------- */

const updateLeaseSchema = z.object({
  leaseId: z.string().min(1),
  unitId: z.string().min(1, "Choose a unit."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the start date."),
  endDate: z.string().optional().or(z.literal("")),
  rent: z.coerce.number().positive("Enter the monthly rent."),
  deposit: z.coerce.number().min(0).optional(),
  dueDay: z.coerce.number().int().min(1).max(28),
  status: z.enum(["pending", "active", "ended"]),
  notes: z.string().trim().max(2000).optional(),
});

export async function updateLease(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = updateLeaseSchema.safeParse({
    leaseId: formData.get("leaseId"),
    unitId: formData.get("unitId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    rent: formData.get("rent"),
    deposit: formData.get("deposit") || 0,
    dueDay: formData.get("dueDay"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;

  if (v.endDate && v.endDate < v.startDate) {
    return { ok: false, message: "The end date can't be before the start date." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("leases")
    .update({
      unit_id: v.unitId,
      start_date: v.startDate,
      end_date: v.endDate || null,
      rent_cents: Math.round(v.rent * 100),
      deposit_cents: Math.round((v.deposit ?? 0) * 100),
      due_day: v.dueDay,
      status: v.status,
      notes: v.notes || null,
    })
    .eq("id", v.leaseId);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePeopleViews();
  return { ok: true, message: "Lease updated." };
}

/**
 * End a tenancy.
 *
 * This — not delete — is what happens when someone moves out. The lease stays
 * on file with an end date, so the invoices and payments attached to it keep
 * making sense, and the unit shows as vacant from here on.
 */
export async function endLease(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing lease." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("leases")
    .update({ status: "ended", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);

  if (error) return { ok: false, message: `Couldn't do that: ${error.message}` };

  revalidatePeopleViews();
  return {
    ok: true,
    message: "Tenancy ended. The unit now shows as vacant, and the history is kept.",
  };
}

/**
 * Delete a lease outright — only sensible for one entered by mistake.
 *
 * Invoices reference leases with ON DELETE SET NULL, so deleting one wouldn't
 * fail; it would quietly cut invoices loose from the agreement they came from.
 * That's worth refusing rather than allowing by accident.
 */
export async function deleteLease(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing lease." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message:
        `Can't delete this lease — ${count} invoice${count === 1 ? "" : "s"} ` +
        `belong${count === 1 ? "s" : ""} to it. End the tenancy instead, which ` +
        `keeps the record straight.`,
    };
  }

  const { error } = await supabase.from("leases").delete().eq("id", id);
  if (error) return { ok: false, message: `Couldn't delete that: ${error.message}` };

  revalidatePeopleViews();
  return { ok: true, message: "Lease deleted." };
}
