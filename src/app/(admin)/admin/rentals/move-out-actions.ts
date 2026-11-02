"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { MOVE_OUT_CHECKLIST } from "@/lib/signing";
import { getDepositEntries, getMoveOut } from "@/lib/data/move-out";
import { storeFile } from "@/lib/maintenance-files";
import type { LeaseRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh(id?: string) {
  revalidatePath("/admin/rentals");
  revalidatePath("/portal");
  if (id) revalidatePath(`/admin/rentals/move-out/${id}`);
}

/**
 * Begin ending a tenancy.
 *
 * The checklist is copied into the move-out rather than referred to, so a list
 * signed in March still reads the same in September even if the wording has
 * been improved since.
 */
export async function startMoveOut(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      leaseId: z.string().min(1, "Pick a tenancy."),
      leavingOn: z.string().min(1, "When are they leaving?"),
    })
    .safeParse({
      leaseId: formData.get("leaseId"),
      leavingOn: formData.get("leavingOn"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { data: leaseRow } = await supabase
    .from("leases")
    .select("*")
    .eq("id", parsed.data.leaseId)
    .maybeSingle();

  const lease = leaseRow as LeaseRow | null;
  if (!lease) return { ok: false, message: "That tenancy isn't there." };

  const { data, error } = await supabase
    .from("move_outs")
    .insert({
      lease_id: lease.id,
      unit_id: lease.unit_id,
      contact_id: lease.contact_id,
      leaving_on: parsed.data.leavingOn,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  const moveOutId = (data as { id: string }).id;

  const { error: itemsError } = await supabase.from("move_out_items").insert(
    MOVE_OUT_CHECKLIST.map((item, index) => ({
      move_out_id: moveOutId,
      position: index + 1,
      area: item.area,
      title: item.title,
      detail: item.detail || null,
    })),
  );

  if (itemsError) return { ok: false, message: itemsError.message };

  // The deposit only becomes a ledger when it matters. If nothing has been
  // recorded for this tenancy yet, open it with what the lease says was taken,
  // so the balance starts from the agreed figure rather than from zero.
  const existing = await getDepositEntries(lease.id);
  if (existing.length === 0 && lease.deposit_cents > 0) {
    await supabase.from("deposit_entries").insert({
      lease_id: lease.id,
      amount_cents: lease.deposit_cents,
      kind: "held",
      reason: "Deposit taken at the start of the tenancy",
      occurred_on: lease.start_date,
    });
  }

  refresh(moveOutId);
  return { ok: true, message: "Started. They can see the list in their account now." };
}

/** What the walk-through found, line by line. */
export async function checkMoveOutItem(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      itemId: z.string().min(1),
      moveOutId: z.string().min(1),
      verdict: z.enum(["ok", "not-ok", "unseen"]),
      note: z.string().trim().max(1000).optional(),
      charge: z.string().trim().optional(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      moveOutId: formData.get("moveOutId"),
      verdict: formData.get("verdict"),
      note: formData.get("note"),
      charge: formData.get("charge"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const dollars = Number(parsed.data.charge ?? "");
  if (parsed.data.charge && (!Number.isFinite(dollars) || dollars < 0)) {
    return { ok: false, message: "That amount doesn't look right." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("move_out_items")
    .update({
      checked_by_admin:
        parsed.data.verdict === "unseen" ? null : parsed.data.verdict === "ok",
      admin_note: parsed.data.note || null,
      charge_cents: parsed.data.charge ? Math.round(dollars * 100) : null,
    })
    .eq("id", parsed.data.itemId);

  if (error) return { ok: false, message: error.message };

  refresh(parsed.data.moveOutId);
  return { ok: true, message: "Saved." };
}

/** The walk-through itself. */
export async function recordInspection(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      moveOutId: z.string().min(1),
      inspectedOn: z.string().min(1, "When did you look round?"),
      notes: z.string().trim().max(4000).optional(),
    })
    .safeParse({
      moveOutId: formData.get("moveOutId"),
      inspectedOn: formData.get("inspectedOn"),
      notes: formData.get("notes"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("move_outs")
    .update({
      status: "inspected",
      inspected_on: parsed.data.inspectedOn,
      inspection_notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.moveOutId);

  if (error) return { ok: false, message: error.message };

  refresh(parsed.data.moveOutId);
  return { ok: true, message: "Recorded." };
}

/**
 * Take something off the deposit, or give it back.
 *
 * A deduction without a reason and a receipt is what comes apart at a
 * tribunal, so both are asked for here rather than left optional in spirit and
 * skipped in practice.
 */
export async function addDepositEntry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      leaseId: z.string().min(1),
      moveOutId: z.string().optional(),
      kind: z.enum(["held", "interest", "deduction", "returned"]),
      amount: z.string().min(1, "How much?"),
      reason: z.string().trim().min(3, "Say what this is for."),
      occurredOn: z.string().min(1),
    })
    .safeParse({
      leaseId: formData.get("leaseId"),
      moveOutId: formData.get("moveOutId") ?? undefined,
      kind: formData.get("kind"),
      amount: formData.get("amount"),
      reason: formData.get("reason"),
      occurredOn: formData.get("occurredOn"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const dollars = Number(parsed.data.amount);
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { ok: false, message: "That amount doesn't look right." };
  }

  // Typed as a plain positive figure, stored with the sign that matches what it
  // does, so the balance is a sum and nothing has to remember which way round a
  // deduction goes.
  const magnitude = Math.round(dollars * 100);
  const outward = parsed.data.kind === "deduction" || parsed.data.kind === "returned";

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  let evidencePath: string | null = null;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    const stored = await storeFile(receipt, "deposits", parsed.data.leaseId);
    if (!stored.ok) return { ok: false, message: stored.message };
    evidencePath = stored.path;
  }

  const { error } = await supabase.from("deposit_entries").insert({
    lease_id: parsed.data.leaseId,
    move_out_id: parsed.data.moveOutId || null,
    amount_cents: outward ? -magnitude : magnitude,
    kind: parsed.data.kind,
    reason: parsed.data.reason,
    occurred_on: parsed.data.occurredOn,
    evidence_path: evidencePath,
  });

  if (error) return { ok: false, message: error.message };

  refresh(parsed.data.moveOutId);
  return { ok: true, message: "Added." };
}

/**
 * Close it off.
 *
 * Refuses while the deposit still shows money either way, because "settled"
 * with a balance outstanding is how a landlord ends up owing it twice.
 */
export async function settleMoveOut(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const moveOutId = String(formData.get("moveOutId") ?? "");
  if (!moveOutId) return { ok: false, message: "Nothing to settle." };

  const found = await getMoveOut(moveOutId);
  if (!found) return { ok: false, message: "That move-out isn't there." };

  const entries = await getDepositEntries(found.moveOut.lease_id);
  const balance = entries.reduce((total, entry) => total + entry.amount_cents, 0);

  if (balance !== 0) {
    return {
      ok: false,
      message:
        balance > 0
          ? "There's still deposit money held. Record what went back to them first."
          : "The deposit is overdrawn — check the deductions before settling.",
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("move_outs")
    .update({ status: "settled" })
    .eq("id", moveOutId);

  if (error) return { ok: false, message: error.message };

  // The tenancy itself is over now.
  await supabase
    .from("leases")
    .update({ status: "ended", end_date: found.moveOut.leaving_on })
    .eq("id", found.moveOut.lease_id);

  refresh(moveOutId);
  return { ok: true, message: "Settled, and the tenancy is marked ended." };
}
