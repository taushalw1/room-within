"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { toCents } from "@/lib/format";
import { GST_RATE } from "@/lib/pricing";

export type ActionResult = { ok: boolean; message: string };

const schema = z.object({
  incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  vendor: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1, "Give it a category."),
  description: z.string().trim().max(500).optional(),
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  tax: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const DEMO_RESULT: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was saved. Connect the database to record real costs.",
};

/**
 * Shared parsing for add and edit, so a rule can't end up enforced on one and
 * not the other.
 */
function readForm(formData: FormData) {
  const parsed = schema.safeParse({
    incurredOn: formData.get("incurredOn"),
    vendor: formData.get("vendor"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    tax: formData.get("tax") || undefined,
    paymentMethod: formData.get("paymentMethod"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const amountCents = toCents(v.amount);

  // The amount entered is what left the bank, so GST is worked back out of it
  // rather than added on top — otherwise the totals wouldn't match the receipt.
  const taxCents =
    v.tax !== undefined && !Number.isNaN(v.tax)
      ? toCents(v.tax)
      : Math.round(amountCents - amountCents / (1 + GST_RATE));

  return {
    ok: true as const,
    row: {
      incurred_on: v.incurredOn,
      vendor: v.vendor || null,
      category: v.category,
      description: v.description || null,
      amount_cents: amountCents,
      tax_cents: taxCents,
      payment_method: v.paymentMethod || null,
      notes: v.notes || null,
    },
  } as const;
}

function revalidateFinanceViews() {
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
}

/** Record something Tausha has spent money on. */
export async function addExpense(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = readForm(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("expenses").insert(parsed.row);
  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateFinanceViews();
  return { ok: true, message: "Cost recorded." };
}

export async function updateExpense(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("expenseId") ?? "");
  if (!id) return { ok: false, message: "Missing cost." };

  const parsed = readForm(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("expenses")
    .update(parsed.row)
    .eq("id", id);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateFinanceViews();
  return { ok: true, message: "Changes saved." };
}

export async function deleteExpense(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing cost." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, message: `Couldn't delete that: ${error.message}` };

  revalidateFinanceViews();
  return { ok: true, message: "Cost deleted." };
}
