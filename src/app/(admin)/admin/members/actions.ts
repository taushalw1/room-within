"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCreditSettings } from "@/lib/data/classes";
import { expiryFor, periodOf } from "@/lib/credits";
import type { MembershipRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh() {
  revalidatePath("/admin/members");
  revalidatePath("/admin/finance");
  revalidatePath("/portal");
}

const money = (dollars: unknown) => Math.round(Number(dollars ?? 0) * 100);

/* ------------------------------ Memberships ------------------------------- */

const membershipSchema = z.object({
  contactId: z.string().min(1, "Whose membership is it?"),
  plan: z.enum(["individual", "family"]),
  householdName: z.string().trim().max(120).optional(),
  monthlyPrice: z.coerce.number().min(0),
  creditsPerMonth: z.coerce.number().int().min(0).max(100),
  startedOn: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Choose a start date."),
  notes: z.string().trim().max(1000).optional(),
});

export async function saveMembership(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = membershipSchema.safeParse({
    contactId: formData.get("contactId"),
    plan: formData.get("plan") || "individual",
    householdName: formData.get("householdName"),
    monthlyPrice: formData.get("monthlyPrice") || 0,
    creditsPerMonth: formData.get("creditsPerMonth") || 0,
    startedOn: formData.get("startedOn"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const record = {
    contact_id: parsed.data.contactId,
    plan: parsed.data.plan,
    household_name: parsed.data.householdName || null,
    monthly_price_cents: money(parsed.data.monthlyPrice),
    credits_per_month: parsed.data.creditsPerMonth,
    started_on: parsed.data.startedOn,
    notes: parsed.data.notes || null,
  };

  const id = String(formData.get("membershipId") ?? "");
  const { error } = id
    ? await supabase.from("memberships").update(record).eq("id", id)
    : await supabase.from("memberships").insert(record);

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: id ? "Membership updated." : "Membership added." };
}

/**
 * End a membership.
 *
 * Credits already earned stay usable until they expire. That is the promise
 * made when they were sold, and honouring it is what stops cancelling from
 * feeling like a punishment.
 */
export async function cancelMembership(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("memberships")
    .update({
      status: "cancelled",
      cancelled_on: new Date().toISOString().slice(0, 10),
    })
    .eq("id", String(formData.get("membershipId") ?? ""));

  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message: "Cancelled. Credits they've already got stay usable until they expire.",
  };
}

/* -------------------------------- Credits --------------------------------- */

/**
 * Hand out this month's credits to every active membership.
 *
 * Safe to run as often as you like — a unique index in the database means a
 * membership can only ever be granted once for a given month, so a second run
 * quietly does nothing rather than doubling anyone's balance.
 */
export async function grantMonthlyCredits(): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const settings = await getCreditSettings();
  const now = new Date();
  const period = periodOf(now);
  const expires = expiryFor(now, settings);

  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("status", "active");

  const memberships = (data as MembershipRow[] | null) ?? [];
  if (!memberships.length) {
    return { ok: true, message: "No active memberships." };
  }

  let granted = 0;
  let already = 0;

  for (const membership of memberships) {
    if (membership.credits_per_month <= 0) continue;

    const { error } = await supabase.from("credit_ledger").insert({
      membership_id: membership.id,
      delta: membership.credits_per_month,
      reason: "monthly",
      period,
      expires_on: expires,
    });

    // 23505 is the one-grant-per-period index doing its job.
    if (error?.code === "23505") already++;
    else if (!error) granted++;
  }

  refresh();
  return {
    ok: true,
    message: granted
      ? `${granted} membership${granted === 1 ? "" : "s"} credited for this month.${already ? ` ${already} already had theirs.` : ""}`
      : "Everyone already has this month's credits.",
  };
}

const adjustSchema = z.object({
  membershipId: z.string().min(1),
  delta: z.coerce.number().int().refine((n) => n !== 0, "How many credits?"),
  note: z.string().trim().max(300).optional(),
});

export async function adjustCredits(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = adjustSchema.safeParse({
    membershipId: formData.get("membershipId"),
    delta: formData.get("delta"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const settings = await getCreditSettings();
  const positive = parsed.data.delta > 0;

  const { error } = await supabase.from("credit_ledger").insert({
    membership_id: parsed.data.membershipId,
    delta: parsed.data.delta,
    reason: positive ? "purchase" : "adjustment",
    expires_on: positive ? expiryFor(new Date(), settings) : null,
    note: parsed.data.note || null,
  });

  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message: positive
      ? `${parsed.data.delta} credits added.`
      : `${-parsed.data.delta} credits taken off.`,
  };
}
