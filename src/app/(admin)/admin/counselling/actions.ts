"use server";

import { revalidatePath } from "next/cache";
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
