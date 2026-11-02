"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { getMyLease } from "@/lib/data/maintenance";
import { removeFile, storeFile } from "@/lib/maintenance-files";
import { notifyAdmin } from "@/lib/email/send";
import type { MaintenanceRequestRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No connection just now." };

function refresh() {
  revalidatePath("/portal");
  revalidatePath("/admin/maintenance");
  revalidatePath("/admin");
}

const reportSchema = z.object({
  title: z.string().trim().min(4, "A few words about what's wrong, please."),
  detail: z.string().trim().max(2000).optional(),
  urgency: z.enum(["whenever", "normal", "urgent"]),
});

/**
 * A renter reports something.
 *
 * The photo is optional on purpose — a leaking tap is worth telling somebody
 * about whether or not you thought to photograph it, and making the camera a
 * requirement is how reports stop getting made.
 */
export async function reportIssue(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const parsed = reportSchema.safeParse({
    title: formData.get("title"),
    detail: formData.get("detail"),
    urgency: formData.get("urgency") || "normal",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  if (!user.contactId) {
    return {
      ok: false,
      message:
        "We couldn't match you to a tenancy. Let Tausha know and she'll sort it.",
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const mine = await getMyLease(user.contactId);

  const photo = formData.get("photo");
  const stored = await storeFile(
    photo instanceof File ? photo : null,
    user.contactId,
    "photo",
  );
  if (!stored.ok) return { ok: false, message: stored.message };

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      unit_id: mine?.unit?.id ?? null,
      lease_id: mine?.lease?.id ?? null,
      contact_id: user.contactId,
      reported_by: user.fullName ?? user.email ?? "A renter",
      title: parsed.data.title,
      detail: parsed.data.detail || null,
      urgency: parsed.data.urgency,
      photo_path: stored.path,
    })
    .select("id")
    .single();

  if (error) {
    // Don't leave an orphaned photo behind if the row didn't save.
    await removeFile(stored.path);
    return { ok: false, message: `Couldn't send that: ${error.message}` };
  }

  await notifyAdmin({
    subject:
      parsed.data.urgency === "urgent"
        ? `Urgent — ${parsed.data.title}`
        : `Maintenance — ${parsed.data.title}`,
    heading: "Something needs looking at",
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong>${parsed.data.title}</strong></p>
      <p style="margin:0 0 14px;">${mine?.unit?.name ?? "Unknown unit"} · reported by ${user.fullName ?? user.email}</p>
      ${parsed.data.detail ? `<p style="margin:0 0 14px;">${parsed.data.detail}</p>` : ""}
      ${stored.path ? `<p style="margin:0 0 14px;">There's a photo with it.</p>` : ""}
      <p style="margin:0;">It's on your list.</p>`,
    ctaPath: "/admin/maintenance",
  });

  refresh();

  return {
    ok: true,
    message:
      parsed.data.urgency === "urgent"
        ? "Sent, and flagged as urgent. Tausha has been emailed."
        : "Sent. Tausha has been told and it's on her list.",
  };
}

/** Change a report, while it is still hers to change. */
export async function updateIssue(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const parsed = reportSchema.safeParse({
    title: formData.get("title"),
    detail: formData.get("detail"),
    urgency: formData.get("urgency") || "normal",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  // Row-level security is what actually stops her editing somebody else's.
  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      title: parsed.data.title,
      detail: parsed.data.detail || null,
      urgency: parsed.data.urgency,
    })
    .eq("id", String(formData.get("id") ?? ""));

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Updated." };
}

export async function withdrawIssue(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const id = String(formData.get("id") ?? "");

  const { data: row } = await supabase
    .from("maintenance_requests")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("maintenance_requests")
    .delete()
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      message:
        "That one can't be withdrawn any more — Tausha has already started on it.",
    };
  }

  await removeFile((row as { photo_path: string | null } | null)?.photo_path ?? null);

  refresh();
  return { ok: true, message: "Withdrawn." };
}

/**
 * The renter says it's sorted.
 *
 * Often they know first — the plumber tells them, not the landlord. Tausha is
 * emailed so she can record what it cost while it is still fresh.
 */
export async function renterMarksFixed(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const id = String(formData.get("id") ?? "");

  const { data, error } = await supabase
    .from("maintenance_requests")
    .update({
      status: "fixed",
      fixed_at: new Date().toISOString(),
      fixed_by: "renter",
    })
    .eq("id", id)
    .select("title, reported_by")
    .single();

  if (error) return { ok: false, message: error.message };

  const row = data as Pick<MaintenanceRequestRow, "title" | "reported_by">;

  await notifyAdmin({
    subject: `Sorted — ${row.title}`,
    heading: "A renter says this one is done",
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong>${row.title}</strong></p>
      <p style="margin:0 0 14px;">${row.reported_by} has marked it as fixed.</p>
      <p style="margin:0;">If it cost anything, it's worth putting the figure in while you remember.</p>`,
    ctaPath: "/admin/maintenance",
  });

  refresh();
  return { ok: true, message: "Thanks — Tausha has been told." };
}
