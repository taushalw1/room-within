"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { storeFile } from "@/lib/maintenance-files";
import { sendRepairDone } from "@/lib/email/send";
import type { MaintenanceRequestRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh(id?: string) {
  revalidatePath("/admin/maintenance");
  revalidatePath("/admin");
  revalidatePath("/portal");
  if (id) revalidatePath(`/admin/maintenance/${id}`);
}

/** Where it has got to, and what she wants the renter to know. */
const progressSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "seen", "doing", "fixed", "declined"]),
  replyToRenter: z.string().trim().max(1000).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

/**
 * Move a report along.
 *
 * Marking it fixed emails the renter — the thing that most often doesn't
 * happen when a landlord is busy, and the thing a tenant notices most.
 */
export async function setMaintenanceStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = progressSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    replyToRenter: formData.get("replyToRenter"),
    adminNotes: formData.get("adminNotes"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const patch: Record<string, unknown> = {
    status: v.status,
    reply_to_renter: v.replyToRenter || null,
    admin_notes: v.adminNotes || null,
  };

  if (v.status === "fixed") {
    patch.fixed_at = new Date().toISOString();
    patch.fixed_by = "tausha";
  } else {
    patch.fixed_at = null;
    patch.fixed_by = null;
  }

  const { data, error } = await supabase
    .from("maintenance_requests")
    .update(patch)
    .eq("id", v.id)
    .select("*, contacts:contact_id (email)")
    .single();

  if (error) return { ok: false, message: error.message };

  const row = data as MaintenanceRequestRow & {
    contacts: { email: string | null } | null;
  };

  let told = false;
  if (v.status === "fixed" && row.contacts?.email) {
    const sent = await sendRepairDone({
      to: row.contacts.email,
      name: row.reported_by,
      title: row.title,
      note: v.replyToRenter || null,
    });
    told = sent.ok;
  }

  refresh(v.id);

  if (v.status === "fixed") {
    return {
      ok: true,
      message: told
        ? "Marked done, and they've been emailed. Worth putting the cost in below."
        : "Marked done. Worth putting the cost in below.",
    };
  }

  return { ok: true, message: "Saved." };
}

/* ------------------------------ What it cost ------------------------------- */

const costSchema = z.object({
  id: z.string().min(1),
  cost: z.coerce.number().min(0).max(1000000),
  note: z.string().trim().max(500).optional(),
  alsoRecord: z.coerce.boolean().optional(),
});

/**
 * Record what a repair cost, and keep the receipt.
 *
 * Optionally writes it straight into the expenses book as well, so a repair
 * is entered once rather than twice. The link back is kept, so the expense
 * can always be traced to the thing that caused it.
 */
export async function recordRepairCost(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = costSchema.safeParse({
    id: formData.get("id"),
    cost: formData.get("cost"),
    note: formData.get("note"),
    alsoRecord: formData.get("alsoRecord") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const receipt = formData.get("receipt");
  const stored = await storeFile(
    receipt instanceof File ? receipt : null,
    `receipts/${v.id}`,
    "receipt",
  );
  if (!stored.ok) return { ok: false, message: stored.message };

  const { data: existing } = await supabase
    .from("maintenance_requests")
    .select("title, expense_id, unit_id, receipt_path")
    .eq("id", v.id)
    .single();

  const row = existing as Pick<
    MaintenanceRequestRow,
    "title" | "expense_id" | "unit_id" | "receipt_path"
  >;

  const cents = Math.round(v.cost * 100);
  let expenseId = row.expense_id;

  // Only write to the books once, however many times this form is saved.
  if (v.alsoRecord && !expenseId && cents > 0) {
    const { data: expense } = await supabase
      .from("expenses")
      .insert({
        incurred_on: new Date().toISOString().slice(0, 10),
        category: "repairs",
        description: `Repair — ${row.title}`,
        amount_cents: cents,
        notes: v.note || null,
      })
      .select("id")
      .single();

    expenseId = (expense?.id as string) ?? null;
  }

  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      cost_cents: cents,
      cost_note: v.note || null,
      receipt_path: stored.path ?? row.receipt_path,
      expense_id: expenseId,
    })
    .eq("id", v.id);

  if (error) return { ok: false, message: error.message };

  refresh(v.id);

  return {
    ok: true,
    message: expenseId
      ? "Saved, and it's in the expenses book too."
      : "Saved.",
  };
}
