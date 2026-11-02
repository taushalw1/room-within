"use server";

import { revalidatePath } from "next/cache";
import { addMonths, format } from "date-fns";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendWelcome } from "@/lib/email/send";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was saved." };
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

const blank = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

const cents = (v: string | undefined) =>
  v == null || v === "" ? 0 : Math.round(Number(v) * 100);

const schema = z.object({
  // Them
  fullName: z.string().trim().min(2, "What is their name?"),
  email: z.string().trim().email("That email doesn't look right.").or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  organisation: z.string().trim().max(160).optional(),

  // The tenancy
  unitId: z.string().min(1, "Which room are they taking?"),
  startDate: z.string().min(1, "When does it start?"),
  endDate: z.string().optional(),
  rent: z.string().min(1, "How much is the rent?"),
  dueDay: z.coerce.number().int().min(1).max(28),

  // The deposit
  deposit: z.string().optional(),
  depositTaken: z.boolean(),

  // Written down now, wanted later
  emergencyName: z.string().trim().max(160).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  emergencyRelationship: z.string().trim().max(80).optional(),
  keysIssued: z.string().optional(),
  vehicle: z.string().trim().max(160).optional(),
  parkingStall: z.string().trim().max(40).optional(),
  otherOccupants: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),

  // What to do once it's saved
  raiseFirstInvoice: z.boolean(),
  sendWelcomeEmail: z.boolean(),
  fromWaitingList: z.string().optional(),
});

/**
 * Move somebody in, in one go.
 *
 * The point of doing it all in one action rather than four screens is that a
 * move-in happens once, at a moment when Tausha is holding keys and talking to
 * a person, and anything left for later gets left. The emergency contact is
 * the clearest example: it is never wanted on the day, and always wanted at
 * eleven at night with water coming through a ceiling.
 *
 * Order matters. The person, then the tenancy, then the money, then the email.
 * If a later step fails the earlier ones stand and the message says exactly
 * what did and didn't happen, because a half-finished move-in that claims to
 * have failed is worse than one that says where it got to.
 */
export async function moveInRenter(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone"),
    organisation: formData.get("organisation"),
    unitId: formData.get("unitId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    rent: formData.get("rent"),
    dueDay: formData.get("dueDay") || 1,
    deposit: formData.get("deposit") || undefined,
    depositTaken: formData.get("depositTaken") === "on",
    emergencyName: formData.get("emergencyName"),
    emergencyPhone: formData.get("emergencyPhone"),
    emergencyRelationship: formData.get("emergencyRelationship"),
    keysIssued: formData.get("keysIssued") || undefined,
    vehicle: formData.get("vehicle"),
    parkingStall: formData.get("parkingStall"),
    otherOccupants: formData.get("otherOccupants"),
    notes: formData.get("notes"),
    raiseFirstInvoice: formData.get("raiseFirstInvoice") === "on",
    sendWelcomeEmail: formData.get("sendWelcomeEmail") === "on",
    fromWaitingList: formData.get("fromWaitingList") || undefined,
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;

  if (v.sendWelcomeEmail && !v.email) {
    return { ok: false, message: "No email address, so there's nowhere to send the welcome." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  // Refuse to put two tenancies in one room rather than discovering it later.
  const { data: taken } = await supabase
    .from("leases")
    .select("id")
    .eq("unit_id", v.unitId)
    .eq("status", "active")
    .maybeSingle();

  if (taken) {
    return {
      ok: false,
      message:
        "Somebody is already in that room. End their tenancy first, or pick a different room.",
    };
  }

  /* --- Them ---------------------------------------------------------------- */

  // Somebody who has booked a room or given before is already on file; a
  // second record for the same person is how two halves of a history end up
  // never meeting.
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
        full_name: v.fullName,
        phone: blank(v.phone),
        organisation: blank(v.organisation),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        full_name: v.fullName,
        email: v.email || null,
        phone: blank(v.phone),
        organisation: blank(v.organisation),
        notes: blank(v.notes),
        tags: ["tenant"],
      })
      .select("id")
      .single();

    if (error) return { ok: false, message: `Couldn't save them: ${error.message}` };
    contactId = created.id as string;
  }

  /* --- The tenancy ---------------------------------------------------------- */

  const depositCents = cents(v.deposit);

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .insert({
      unit_id: v.unitId,
      contact_id: contactId,
      start_date: v.startDate,
      end_date: v.endDate || null,
      rent_cents: cents(v.rent),
      deposit_cents: depositCents,
      due_day: v.dueDay,
      status: "active",
      notes: blank(v.notes),
      emergency_name: blank(v.emergencyName),
      emergency_phone: blank(v.emergencyPhone),
      emergency_relationship: blank(v.emergencyRelationship),
      keys_issued: v.keysIssued ? Number(v.keysIssued) : null,
      vehicle: blank(v.vehicle),
      parking_stall: blank(v.parkingStall),
      other_occupants: blank(v.otherOccupants),
      from_waiting_list: v.fromWaitingList || null,
    })
    .select("id")
    .single();

  if (leaseError) {
    return {
      ok: false,
      message: `${v.fullName} is on your people list, but the tenancy wasn't saved: ${leaseError.message}`,
    };
  }

  const leaseId = (lease as { id: string }).id;
  const done: string[] = [];
  const notDone: string[] = [];

  /* --- The money ------------------------------------------------------------ */

  // Opening the deposit ledger here is what makes the end of the tenancy
  // honest. A deposit that was never recorded as taken is one nobody can prove
  // was taken, and the person it hurts is the tenant.
  if (depositCents > 0 && v.depositTaken) {
    const { error } = await supabase.from("deposit_entries").insert({
      lease_id: leaseId,
      amount_cents: depositCents,
      kind: "held",
      reason: "Deposit taken at the start of the tenancy",
      occurred_on: v.startDate,
    });
    if (error) notDone.push("the deposit record");
    else done.push("the deposit recorded");
  }

  if (v.raiseFirstInvoice) {
    const start = new Date(`${v.startDate}T00:00:00`);
    const periodEnd = format(addMonths(start, 1), "yyyy-MM-dd");

    const { error } = await supabase.from("invoices").insert({
      contact_id: contactId,
      lease_id: leaseId,
      kind: "rent",
      description: `Rent — ${format(start, "MMMM yyyy")}`,
      period_start: v.startDate,
      period_end: periodEnd,
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: v.startDate,
      amount_cents: cents(v.rent),
      tax_cents: 0,
      status: "sent",
    });

    if (error) notDone.push("the first rent invoice");
    else done.push("the first rent invoice raised");
  }

  /* --- Off the waiting list -------------------------------------------------- */

  if (v.fromWaitingList) {
    await supabase
      .from("waiting_list")
      .update({ status: "housed", last_contacted_on: format(new Date(), "yyyy-MM-dd") })
      .eq("id", v.fromWaitingList);
    done.push("taken off the waiting list");
  }

  /* --- The welcome ----------------------------------------------------------- */

  if (v.sendWelcomeEmail && v.email) {
    const sent = await sendWelcome({ to: v.email, name: v.fullName });
    if (sent.ok) done.push("a welcome email sent");
    else notDone.push("the welcome email");
  }

  revalidatePath("/admin/rentals");
  revalidatePath("/admin/contacts");
  revalidatePath("/admin");
  revalidatePath("/portal");

  const tail = [
    done.length > 0 ? `${done.join(", ")}.` : "",
    notDone.length > 0
      ? `What didn't go through: ${notDone.join(", ")} — worth doing by hand.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: notDone.length === 0,
    message: `${v.fullName} is in. ${tail}`.trim(),
  };
}
