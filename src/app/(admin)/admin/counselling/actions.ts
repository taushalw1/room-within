"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

/** Save (or create) the clinical note attached to a session. */
export async function saveNote(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (isDemoMode) {
    return { ok: false, message: "Demo mode — nothing was saved." };
  }

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!appointmentId) return { ok: false, message: "Missing session." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { data: existing } = await supabase
    .from("counselling_notes")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("counselling_notes")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase
        .from("counselling_notes")
        .insert({ appointment_id: appointmentId, body });

  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };

  const service = getServiceSupabase();
  await service?.from("counselling_access_log").insert({
    note_id: appointmentId,
    actor_id: admin.id,
    action: existing ? "update" : "create",
  });

  revalidatePath(`/admin/counselling/${appointmentId}`);
  return { ok: true, message: "Saved." };
}

/* ---------------------------------------------------------------------------
   Tasks — Tausha's private to-do list
   --------------------------------------------------------------------------- */

const DEMO_RESULT: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was saved. Connect the database for a real list.",
};

const AREAS = ["general", "rentals", "bookings", "finance", "counselling"] as const;

const taskSchema = z.object({
  title: z.string().trim().min(2, "What's the task?"),
  notes: z.string().trim().max(2000).optional(),
  dueDate: z.string().optional(),
  area: z.enum(AREAS),
  status: z.enum(["open", "doing", "done"]),
});

function revalidateTaskViews() {
  revalidatePath("/admin/counselling");
  revalidatePath("/admin");
}

export async function addTask(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes"),
    dueDate: formData.get("dueDate") || undefined,
    area: formData.get("area") || "general",
    status: formData.get("status") || "open",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("tasks").insert({
    title: v.title,
    notes: v.notes || null,
    due_date: v.dueDate || null,
    area: v.area,
    status: v.status,
  });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateTaskViews();
  return { ok: true, message: "Added to your list." };
}

export async function updateTask(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("taskId") ?? "");
  if (!id) return { ok: false, message: "Missing task." };

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes"),
    dueDate: formData.get("dueDate") || undefined,
    area: formData.get("area") || "general",
    status: formData.get("status") || "open",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("tasks")
    .update({
      title: v.title,
      notes: v.notes || null,
      due_date: v.dueDate || null,
      area: v.area,
      status: v.status,
    })
    .eq("id", id);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateTaskViews();
  return { ok: true, message: "Changes saved." };
}

/**
 * One-click move through open → doing → done. Ticking something off is the
 * most frequent thing anyone does to a list, so it shouldn't need the form.
 */
export async function cycleTaskStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !["open", "doing", "done"].includes(status)) {
    return { ok: false, message: "That didn't work." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidateTaskViews();
  return { ok: true, message: status === "done" ? "Ticked off." : "Updated." };
}

export async function deleteTask(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing task." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, message: `Couldn't delete that: ${error.message}` };

  revalidateTaskViews();
  return { ok: true, message: "Deleted." };
}
