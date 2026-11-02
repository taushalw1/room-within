"use server";

import { revalidatePath } from "next/cache";
import { addMonths, format } from "date-fns";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { storeFile } from "@/lib/maintenance-files";
import type { RecurringTaskRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was changed." };
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh() {
  revalidatePath("/admin/building");
  revalidatePath("/admin/maintenance");
  revalidatePath("/admin");
}

const blank = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/* --- Who she calls -------------------------------------------------------- */

export async function saveContractor(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2, "What are they called?"),
      trade: z.string().trim().min(2, "What do they do?"),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().max(200).optional(),
      notes: z.string().trim().max(2000).optional(),
      howItWent: z.string().trim().max(2000).optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      trade: formData.get("trade"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      notes: formData.get("notes"),
      howItWent: formData.get("howItWent"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const row = {
    name: parsed.data.name,
    trade: parsed.data.trade,
    phone: blank(parsed.data.phone ?? null),
    email: blank(parsed.data.email ?? null),
    notes: blank(parsed.data.notes ?? null),
    how_it_went: blank(parsed.data.howItWent ?? null),
  };

  const { error } = parsed.data.id
    ? await supabase.from("contractors").update(row).eq("id", parsed.data.id)
    : await supabase.from("contractors").insert(row);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  refresh();
  return { ok: true, message: parsed.data.id ? "Saved." : `${row.name} added.` };
}

/** Take somebody off the list without losing the repairs they did. */
export async function retireContractor(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Nothing to remove." };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  // Hidden rather than deleted, so the repair history still says who did it.
  const { error } = await supabase
    .from("contractors")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Taken off the list." };
}

/* --- Jobs that come round -------------------------------------------------- */

export async function saveRecurringTask(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      id: z.string().optional(),
      title: z.string().trim().min(3, "What's the job?"),
      detail: z.string().trim().max(2000).optional(),
      area: z.string().trim().max(120).optional(),
      unitId: z.string().optional(),
      everyMonths: z.coerce.number().int().min(1).max(60),
      nextDueOn: z.string().min(1, "When is it next due?"),
      contractorId: z.string().optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      title: formData.get("title"),
      detail: formData.get("detail"),
      area: formData.get("area"),
      unitId: formData.get("unitId") || undefined,
      everyMonths: formData.get("everyMonths"),
      nextDueOn: formData.get("nextDueOn"),
      contractorId: formData.get("contractorId") || undefined,
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const row = {
    title: parsed.data.title,
    detail: blank(parsed.data.detail ?? null),
    area: blank(parsed.data.area ?? null),
    unit_id: parsed.data.unitId || null,
    every_months: parsed.data.everyMonths,
    next_due_on: parsed.data.nextDueOn,
    contractor_id: parsed.data.contractorId || null,
  };

  const { error } = parsed.data.id
    ? await supabase.from("recurring_tasks").update(row).eq("id", parsed.data.id)
    : await supabase.from("recurring_tasks").insert(row);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  refresh();
  return { ok: true, message: parsed.data.id ? "Saved." : "Added to the list." };
}

/**
 * Mark a recurring job done, and set the next one.
 *
 * Counted from the day it was actually done rather than from the day it was
 * due. A furnace serviced two months late should next be serviced twelve
 * months after that, not ten — otherwise being late once makes every year
 * afterwards slightly wrong.
 */
export async function markTaskDone(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  const doneOn = String(formData.get("doneOn") ?? "") || format(new Date(), "yyyy-MM-dd");
  if (!id) return { ok: false, message: "Nothing to tick off." };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { data } = await supabase
    .from("recurring_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const task = data as RecurringTaskRow | null;
  if (!task) return { ok: false, message: "That job isn't there." };

  const next = format(
    addMonths(new Date(`${doneOn}T00:00:00`), task.every_months),
    "yyyy-MM-dd",
  );

  const { error } = await supabase
    .from("recurring_tasks")
    .update({ last_done_on: doneOn, next_due_on: next })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: `Done. Next one due ${next}.` };
}

/* --- What is still covered ------------------------------------------------- */

export async function saveWarranty(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      id: z.string().optional(),
      item: z.string().trim().min(2, "What is it?"),
      unitId: z.string().optional(),
      supplier: z.string().trim().max(200).optional(),
      supplierPhone: z.string().trim().max(40).optional(),
      purchasedOn: z.string().optional(),
      expiresOn: z.string().optional(),
      cost: z.string().optional(),
      notes: z.string().trim().max(2000).optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      item: formData.get("item"),
      unitId: formData.get("unitId") || undefined,
      supplier: formData.get("supplier"),
      supplierPhone: formData.get("supplierPhone"),
      purchasedOn: formData.get("purchasedOn") || undefined,
      expiresOn: formData.get("expiresOn") || undefined,
      cost: formData.get("cost") || undefined,
      notes: formData.get("notes"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const dollars = parsed.data.cost ? Number(parsed.data.cost) : null;
  if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) {
    return { ok: false, message: "That amount doesn't look right." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  let documentPath: string | null = null;
  const file = formData.get("document");
  if (file instanceof File && file.size > 0) {
    const stored = await storeFile(file, "warranties", parsed.data.item.slice(0, 30));
    if (!stored.ok) return { ok: false, message: stored.message };
    documentPath = stored.path;
  }

  const row = {
    item: parsed.data.item,
    unit_id: parsed.data.unitId || null,
    supplier: blank(parsed.data.supplier ?? null),
    supplier_phone: blank(parsed.data.supplierPhone ?? null),
    purchased_on: parsed.data.purchasedOn || null,
    expires_on: parsed.data.expiresOn || null,
    cost_cents: dollars === null ? null : Math.round(dollars * 100),
    notes: blank(parsed.data.notes ?? null),
    // Only overwrite the stored document when a new one was actually sent.
    ...(documentPath ? { document_path: documentPath } : {}),
  };

  const { error } = parsed.data.id
    ? await supabase.from("warranties").update(row).eq("id", parsed.data.id)
    : await supabase.from("warranties").insert(row);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  refresh();
  return { ok: true, message: parsed.data.id ? "Saved." : `${row.item} added.` };
}
