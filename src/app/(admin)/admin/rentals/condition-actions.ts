"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { storeFile } from "@/lib/maintenance-files";
import { CONDITION_CHECKLIST } from "@/lib/condition";

export type ActionResult = { ok: boolean; message: string; reportId?: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was saved." };

const RATINGS = ["good", "fair", "poor", "damaged", "missing", "na"] as const;

/**
 * Start an inspection.
 *
 * The item list is written out in full at the moment the report is created,
 * rather than looked up from the template when it is read. The template will
 * change — a line will be reworded, another added — and a report from two
 * years ago has to still say what was actually inspected and signed, not what
 * the current list happens to contain.
 */
export async function startInspection(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      leaseId: z.string().uuid(),
      kind: z.enum(["move_in", "move_out"]),
      inspectedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
      tenantPresent: z.coerce.boolean().optional(),
    })
    .safeParse({
      leaseId: formData.get("leaseId"),
      kind: formData.get("kind"),
      inspectedOn: formData.get("inspectedOn"),
      tenantPresent: formData.get("tenantPresent") === "on",
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: lease } = await supabase
    .from("leases")
    .select("id, unit_id, contact_id")
    .eq("id", parsed.data.leaseId)
    .maybeSingle();

  if (!lease) return { ok: false, message: "I can't find that tenancy." };

  const { data: report, error } = await supabase
    .from("condition_reports")
    .insert({
      lease_id: parsed.data.leaseId,
      unit_id: (lease as { unit_id: string | null }).unit_id,
      contact_id: (lease as { contact_id: string | null }).contact_id,
      kind: parsed.data.kind,
      inspected_on: parsed.data.inspectedOn,
      tenant_present: parsed.data.tenantPresent ?? false,
    })
    .select("id")
    .single();

  if (error) {
    // The unique index is doing its job: a second move-in report is a mistake
    // rather than a revision, and saying so is more use than a raw error.
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          parsed.data.kind === "move_in"
            ? "There's already a move-in inspection for this tenancy."
            : "There's already a move-out inspection for this tenancy.",
      };
    }
    return { ok: false, message: error.message };
  }

  const reportId = (report as { id: string }).id;

  const { error: itemsError } = await supabase.from("condition_items").insert(
    CONDITION_CHECKLIST.map((line, index) => ({
      report_id: reportId,
      position: index + 1,
      area: line.area,
      item: line.item,
    })),
  );

  if (itemsError) {
    await supabase.from("condition_reports").delete().eq("id", reportId);
    return { ok: false, message: `Couldn't set it up: ${itemsError.message}` };
  }

  revalidatePath("/admin/rentals");
  return { ok: true, message: "Inspection started.", reportId };
}

/** Record how one item looked, with an optional photograph. */
export async function saveConditionItem(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      itemId: z.string().uuid(),
      rating: z.enum(RATINGS),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      rating: formData.get("rating"),
      note: formData.get("note"),
    });

  if (!parsed.success) {
    return { ok: false, message: "Choose how it looked first." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const photo = formData.get("photo");
  const patch: Record<string, unknown> = {
    rating: parsed.data.rating,
    note: parsed.data.note || null,
  };

  if (photo instanceof File && photo.size > 0) {
    const stored = await storeFile(photo, "condition", parsed.data.itemId);
    if (!stored.ok) return { ok: false, message: stored.message };
    if (stored.path) patch.photo_path = stored.path;
  }

  const { error } = await supabase
    .from("condition_items")
    .update(patch)
    .eq("id", parsed.data.itemId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/rentals");
  return { ok: true, message: "Saved." };
}

/**
 * Hand the report to the tenant.
 *
 * Once it is with them they can add their own view of each item, and only
 * then. Their assessment is never written over hers, and hers stops being
 * editable — a report that both sides can keep changing is not a record of
 * anything.
 */
export async function sendInspectionToTenant(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const reportId = z.string().uuid().safeParse(formData.get("reportId"));
  if (!reportId.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: items } = await supabase
    .from("condition_items")
    .select("id, rating")
    .eq("report_id", reportId.data);

  const unrated = ((items as { rating: string | null }[]) ?? []).filter(
    (i) => i.rating === null,
  ).length;

  if (unrated > 0) {
    return {
      ok: false,
      message: `${unrated} item${unrated === 1 ? " still needs" : "s still need"} a mark before you send it.`,
    };
  }

  const { data, error } = await supabase
    .from("condition_reports")
    .update({ status: "awaiting_tenant" })
    .eq("id", reportId.data)
    .eq("status", "draft")
    .select("id");

  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return { ok: false, message: "That report has already been sent." };
  }

  revalidatePath("/admin/rentals");
  revalidatePath("/portal");
  return { ok: true, message: "Sent. They can now add their own view of it." };
}
