"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { toCents } from "@/lib/format";
import { GST_RATE } from "@/lib/pricing";
import { nextDue } from "@/lib/recurring";
import { MILEAGE_SETTING_KEY } from "@/lib/data/books";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was saved." };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The database refuses anything dated inside a closed year, and says so
 * clearly. Passing that message straight through is better than inventing a
 * friendlier one that loses the date it names.
 */
function explain(error: { message: string }): ActionResult {
  return { ok: false, message: error.message };
}

/* -------------------------------------------------------------------------- */
/*  Bills                                                                     */
/* -------------------------------------------------------------------------- */

const billSchema = z.object({
  vendor: z.string().trim().min(1, "Who is it from?"),
  category: z.string().trim().min(1, "Give it a category."),
  description: z.string().trim().max(500).optional(),
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  tax: z.coerce.number().min(0).optional(),
  issuedOn: z.string().regex(DATE).optional().or(z.literal("")),
  dueOn: z.string().regex(DATE, "When is it due?"),
  notes: z.string().trim().max(2000).optional(),
});

export async function saveBill(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = billSchema.safeParse({
    vendor: formData.get("vendor"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    tax: formData.get("tax") || undefined,
    issuedOn: formData.get("issuedOn") ?? "",
    dueOn: formData.get("dueOn"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const amountCents = toCents(v.amount);

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase.from("bills").insert({
    vendor: v.vendor,
    category: v.category,
    description: v.description || null,
    amount_cents: amountCents,
    // Same reasoning as a cost: the figure on the bill includes the tax, so
    // the GST is worked back out of it rather than added on top.
    tax_cents:
      v.tax !== undefined && !Number.isNaN(v.tax)
        ? toCents(v.tax)
        : Math.round(amountCents - amountCents / (1 + GST_RATE)),
    issued_on: v.issuedOn || null,
    due_on: v.dueOn,
    notes: v.notes || null,
  });

  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  revalidatePath("/admin/finance");
  return { ok: true, message: "Added to what you owe." };
}

/**
 * Pay a bill.
 *
 * The cost is created first and the bill is only marked paid once it exists,
 * because the database refuses a paid bill with nothing behind it. Doing it
 * the other way round would mean a moment where the books say paid and show
 * no money leaving.
 */
export async function payBill(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      billId: z.string().uuid(),
      paidOn: z.string().regex(DATE, "When did you pay it?"),
    })
    .safeParse({
      billId: formData.get("billId"),
      paidOn: formData.get("paidOn"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("id", parsed.data.billId)
    .maybeSingle();

  const row = bill as
    | {
        vendor: string;
        description: string | null;
        category: string;
        amount_cents: number;
        tax_cents: number;
        unit_id: string | null;
        status: string;
      }
    | null;

  if (!row) return { ok: false, message: "I can't find that bill." };
  if (row.status !== "open") {
    return { ok: false, message: "That one's already been dealt with." };
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      incurred_on: parsed.data.paidOn,
      vendor: row.vendor,
      category: row.category,
      description: row.description,
      amount_cents: row.amount_cents + row.tax_cents,
      tax_cents: row.tax_cents,
      unit_id: row.unit_id,
      payment_method: "bank",
      notes: "Paid from a bill.",
    })
    .select("id")
    .single();

  if (error) return explain(error);

  const expenseId = (expense as { id: string }).id;

  const { data: updated, error: linkError } = await supabase
    .from("bills")
    .update({ status: "paid", expense_id: expenseId })
    .eq("id", parsed.data.billId)
    .eq("status", "open")
    .select("id");

  if (linkError || !updated || updated.length === 0) {
    // The cost exists with nothing pointing at it, which would look like a
    // duplicate next time. Take it back out rather than leave that behind.
    await supabase.from("expenses").delete().eq("id", expenseId);
    return {
      ok: false,
      message: "That bill changed while I was working — nothing was recorded.",
    };
  }

  revalidatePath("/admin/finance/costs");
  revalidatePath("/admin/finance");
  return { ok: true, message: "Paid, and recorded as a cost." };
}

export async function voidBill(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = z.string().uuid().safeParse(formData.get("billId"));
  if (!id.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase
    .from("bills")
    .update({ status: "void" })
    .eq("id", id.data)
    .eq("status", "open");

  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Cancelled. It stays on the list as cancelled." };
}

/* -------------------------------------------------------------------------- */
/*  Costs that repeat                                                         */
/* -------------------------------------------------------------------------- */

export async function saveRecurringCost(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      vendor: z.string().trim().min(1, "Who is it to?"),
      category: z.string().trim().min(1, "Give it a category."),
      amount: z.coerce.number().positive("Enter an amount greater than zero."),
      cadence: z.enum(["monthly", "quarterly", "yearly"]),
      nextDue: z.string().regex(DATE, "When is the next one?"),
      notes: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      vendor: formData.get("vendor"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      cadence: formData.get("cadence"),
      nextDue: formData.get("nextDue"),
      notes: formData.get("notes"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase.from("recurring_costs").insert({
    vendor: parsed.data.vendor,
    category: parsed.data.category,
    amount_cents: toCents(parsed.data.amount),
    cadence: parsed.data.cadence,
    next_due: parsed.data.nextDue,
    notes: parsed.data.notes || null,
  });

  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Saved." };
}

/**
 * Turn the next occurrence into a bill, and move the date on.
 *
 * The date moves using the day of the month the cost was first set up on, so
 * a payment on the 31st clamps to the 28th in February and goes back to the
 * 31st in March rather than drifting earlier for ever.
 */
export async function raiseFromRecurring(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: found } = await supabase
    .from("recurring_costs")
    .select("*")
    .eq("id", id.data)
    .maybeSingle();

  const cost = found as
    | {
        vendor: string;
        category: string;
        amount_cents: number;
        cadence: "monthly" | "quarterly" | "yearly";
        next_due: string;
        notes: string | null;
        created_at: string;
      }
    | null;

  if (!cost) return { ok: false, message: "I can't find that one." };

  const { error } = await supabase.from("bills").insert({
    vendor: cost.vendor,
    category: cost.category,
    description: cost.notes,
    amount_cents: cost.amount_cents,
    tax_cents: Math.round(
      cost.amount_cents - cost.amount_cents / (1 + GST_RATE),
    ),
    due_on: cost.next_due,
    notes: "Raised from a cost that repeats.",
  });

  if (error) return explain(error);

  await supabase
    .from("recurring_costs")
    .update({ next_due: nextDue(cost.next_due, cost.cadence) })
    .eq("id", id.data);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Added to what you owe, and the date moved on." };
}

export async function stopRecurringCost(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase
    .from("recurring_costs")
    .update({ is_active: false })
    .eq("id", id.data);

  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Stopped. It won't be suggested again." };
}

/* -------------------------------------------------------------------------- */
/*  Mileage                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveMileageRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z.coerce
    .number()
    .positive("Enter the rate in cents, e.g. 70.")
    .max(500)
    .safeParse(formData.get("cents"));

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: MILEAGE_SETTING_KEY, value: { cents: Math.round(parsed.data) } },
      { onConflict: "key" },
    );

  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Rate saved." };
}

export async function saveTrip(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      travelledOn: z.string().regex(DATE, "When was it?"),
      purpose: z.string().trim().min(1, "What was the trip for?"),
      fromPlace: z.string().trim().max(120).optional(),
      toPlace: z.string().trim().max(120).optional(),
      kilometres: z.coerce.number().positive("How far, in kilometres?"),
      rate: z.coerce.number().positive("Set the rate first.").max(500),
    })
    .safeParse({
      travelledOn: formData.get("travelledOn"),
      purpose: formData.get("purpose"),
      fromPlace: formData.get("fromPlace"),
      toPlace: formData.get("toPlace"),
      kilometres: formData.get("kilometres"),
      rate: formData.get("rate"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase.from("trips").insert({
    travelled_on: parsed.data.travelledOn,
    purpose: parsed.data.purpose,
    from_place: parsed.data.fromPlace || null,
    to_place: parsed.data.toPlace || null,
    kilometres: parsed.data.kilometres,
    // Copied onto the trip rather than looked up later, so a trip keeps the
    // rate that applied in its own year for ever.
    rate_cents_per_km: Math.round(parsed.data.rate),
  });

  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Trip recorded." };
}

export async function deleteTrip(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase.from("trips").delete().eq("id", id.data);
  if (error) return explain(error);

  revalidatePath("/admin/finance/costs");
  return { ok: true, message: "Removed." };
}
