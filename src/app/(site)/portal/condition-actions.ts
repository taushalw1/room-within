"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { signDocument } from "./signature-actions";
import { RATING_LABEL, type Rating } from "@/lib/condition";

export type ActionResult = { ok: boolean; message: string; verifyCode?: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was saved." };

const RATINGS = ["good", "fair", "poor", "damaged", "missing", "na"] as const;

/**
 * Record what the tenant thought of one item.
 *
 * Written through their own session, so the policy and the column guard in
 * 0022 are what decide whether it lands — not this code. Their view goes into
 * its own columns and never touches hers, which is the whole point: a report
 * where the two sides disagreed, and said so at the time, is worth more than
 * one that kept whichever answer was typed last.
 */
export async function saveMyConditionView(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser("/portal");
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

  if (!parsed.success) return { ok: false, message: "Choose how it looked." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase
    .from("condition_items")
    .update({
      tenant_rating: parsed.data.rating,
      tenant_note: parsed.data.note || null,
    })
    .eq("id", parsed.data.itemId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/portal");
  return { ok: true, message: "Saved." };
}

/**
 * Sign the report off.
 *
 * The text that gets sealed is built here from the rows as they actually
 * stand, item by item, including every place the two sides differed. Signing
 * a summary would make the signature worth nothing: what is signed has to be
 * the thing itself, or there is no answer to "that isn't what I agreed to".
 */
export async function signConditionReport(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const reportId = z.string().uuid().safeParse(formData.get("reportId"));
  if (!reportId.success) return { ok: false, message: "That didn't come through." };

  const agreed = formData.get("agreed") === "yes";

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const [{ data: report }, { data: items }] = await Promise.all([
    supabase
      .from("condition_reports")
      .select("id, kind, inspected_on, status, contact_id, landlord_note")
      .eq("id", reportId.data)
      .maybeSingle(),
    supabase
      .from("condition_items")
      .select("position, area, item, rating, note, tenant_rating, tenant_note")
      .eq("report_id", reportId.data)
      .order("position", { ascending: true }),
  ]);

  if (!report) return { ok: false, message: "I can't find that report." };

  const r = report as {
    kind: string;
    inspected_on: string | null;
    status: string;
    landlord_note: string | null;
  };

  if (r.status !== "awaiting_tenant") {
    return { ok: false, message: "That report has already been signed." };
  }

  const rows =
    (items as {
      area: string;
      item: string;
      rating: Rating | null;
      note: string | null;
      tenant_rating: Rating | null;
      tenant_note: string | null;
    }[]) ?? [];

  const lines = rows.map((i) => {
    const mine = i.tenant_rating ? RATING_LABEL[i.tenant_rating] : "no comment";
    const theirs = i.rating ? RATING_LABEL[i.rating] : "not marked";
    const same = i.tenant_rating === i.rating || !i.tenant_rating;

    return [
      `${i.area} — ${i.item}: ${theirs}`,
      i.note ? `    landlord: ${i.note}` : null,
      same ? null : `    tenant says: ${mine}`,
      i.tenant_note ? `    tenant: ${i.tenant_note}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const title = `${r.kind === "move_in" ? "Move-in" : "Move-out"} inspection report`;

  const documentText = [
    title,
    `Inspected: ${r.inspected_on ?? "date not recorded"}`,
    r.landlord_note ? `Landlord note: ${r.landlord_note}` : null,
    "",
    ...lines,
    "",
    agreed
      ? "The tenant agrees this report is an accurate record of the condition of the premises."
      : "The tenant does NOT agree with this report. Their comments above record where and why.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const signed = await signDocument({
    documentType: "condition_report",
    documentId: reportId.data,
    documentTitle: title,
    documentText,
  });

  if (!signed.ok) return { ok: false, message: signed.message };

  // The status is set after the signature exists, so a report can never be
  // marked agreed without one behind it.
  const { error } = await supabase
    .from("condition_reports")
    .update({
      status: agreed ? "agreed" : "disputed",
      tenant_signature_event: signed.eventId ?? null,
    })
    .eq("id", reportId.data);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/portal");
  revalidatePath("/admin/rentals");

  return {
    ok: true,
    message: agreed
      ? "Signed. A copy is on your account and nobody can change it now."
      : "Recorded, with your disagreement. Nobody can change it now.",
    verifyCode: signed.verifyCode,
  };
}
