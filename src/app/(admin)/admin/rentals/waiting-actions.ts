"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was changed." };
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh() {
  revalidatePath("/admin/rentals");
}

const blank = (v: string | undefined | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/** Put somebody's name down. */
export async function addToWaitingList(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "What are they called?"),
      email: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(40).optional(),
      lookingFor: z.string().trim().max(1000).optional(),
      budget: z.string().optional(),
      neededFrom: z.string().optional(),
      notes: z.string().trim().max(2000).optional(),
      kindOffice: z.boolean(),
      kindSuite: z.boolean(),
      kindRetail: z.boolean(),
      kindStorage: z.boolean(),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      lookingFor: formData.get("lookingFor"),
      budget: formData.get("budget") || undefined,
      neededFrom: formData.get("neededFrom") || undefined,
      notes: formData.get("notes"),
      kindOffice: formData.get("kindOffice") === "on",
      kindSuite: formData.get("kindSuite") === "on",
      kindRetail: formData.get("kindRetail") === "on",
      kindStorage: formData.get("kindStorage") === "on",
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;

  if (!v.email?.trim() && !v.phone?.trim()) {
    return { ok: false, message: "A phone number or an email — otherwise you can't tell them." };
  }

  const dollars = v.budget ? Number(v.budget) : null;
  if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) {
    return { ok: false, message: "That budget doesn't look right." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("waiting_list").insert({
    full_name: v.fullName,
    email: blank(v.email),
    phone: blank(v.phone),
    looking_for: blank(v.lookingFor),
    unit_kinds: [
      ...(v.kindOffice ? ["office"] : []),
      ...(v.kindSuite ? ["suite"] : []),
      ...(v.kindRetail ? ["retail"] : []),
      ...(v.kindStorage ? ["storage"] : []),
    ],
    budget_cents: dollars === null ? null : Math.round(dollars * 100),
    needed_from: v.neededFrom || null,
    notes: blank(v.notes),
  });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  refresh();
  return { ok: true, message: `${v.fullName} added to the list.` };
}

/** Move somebody along, or take them off. */
export async function updateWaitingEntry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      id: z.string().min(1),
      status: z.enum(["waiting", "offered", "housed", "gone"]),
      contacted: z.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      status: formData.get("status"),
      contacted: formData.get("contacted") === "yes",
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("waiting_list")
    .update({
      status: parsed.data.status,
      ...(parsed.data.contacted
        ? { last_contacted_on: format(new Date(), "yyyy-MM-dd") }
        : {}),
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Saved." };
}
