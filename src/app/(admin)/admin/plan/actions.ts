"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

const refresh = () => revalidatePath("/admin/plan");

/* --------------------------------- Tasks ---------------------------------- */

const taskStatus = z.enum(["todo", "doing", "blocked", "done"]);

export async function setTaskStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  const parsed = taskStatus.safeParse(formData.get("status"));
  if (!parsed.success) return { ok: false, message: "That isn't one of the options." };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("project_tasks")
    .update({
      status: parsed.data,
      done_at: parsed.data === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message: parsed.data === "done" ? "Ticked off." : "Moved.",
  };
}

export async function saveTaskNotes(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const notes = String(formData.get("notes") ?? "").trim();
  const { error } = await supabase
    .from("project_tasks")
    .update({ notes: notes || null })
    .eq("id", String(formData.get("id") ?? ""));

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Saved." };
}

/* --------------------------------- Gates ---------------------------------- */

const gateStatus = z.enum(["not_started", "in_progress", "passed"]);

/**
 * Move a gate.
 *
 * Passing one is the consequential act — it is the point at which real money
 * starts being spent — so the date it was passed is recorded, and the page
 * asks for a confirmation first.
 */
export async function setGateStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  const parsed = gateStatus.safeParse(formData.get("status"));
  if (!parsed.success) return { ok: false, message: "That isn't one of the options." };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("project_gates")
    .update({
      status: parsed.data,
      passed_on:
        parsed.data === "passed" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message:
      parsed.data === "passed"
        ? "Gate passed. The date is recorded."
        : "Saved.",
  };
}

export async function saveGateNotes(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const notes = String(formData.get("notes") ?? "").trim();
  const { error } = await supabase
    .from("project_gates")
    .update({ notes: notes || null })
    .eq("id", String(formData.get("id") ?? ""));

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Saved." };
}
