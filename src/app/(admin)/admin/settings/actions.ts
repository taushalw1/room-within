"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { toCents } from "@/lib/format";

export type ActionResult = { ok: boolean; message: string };

const DEMO_RESULT: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was saved. Connect the database to change real rates.",
};

/** Rates show up on the public pages too, so those get refreshed as well. */
function revalidateRateViews() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/bookings");
  revalidatePath("/spaces");
  revalidatePath("/book");
  revalidatePath("/");
}

/* ---------------------------------------------------------------------------
   Room rates
   --------------------------------------------------------------------------- */

const roomSchema = z
  .object({
    roomId: z.string().min(1),
    name: z.string().trim().min(2, "Give the room a name."),
    description: z.string().trim().max(1000).optional(),
    capacity: z.coerce.number().int().min(0).max(500).optional(),
    hourly: z.coerce.number().min(0, "Rates can't be negative."),
    halfDay: z.string().optional(),
    fullDay: z.string().optional(),
    minHours: z.coerce.number().min(0.25).max(12),
    requiresApproval: z.coerce.boolean().optional(),
    isBookable: z.coerce.boolean().optional(),
  })
  .refine((v) => v.hourly > 0 || v.halfDay || v.fullDay, {
    message: "Set at least one rate, or the room can't be priced.",
  });

export async function updateRoom(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = roomSchema.safeParse({
    roomId: formData.get("roomId"),
    name: formData.get("name"),
    description: formData.get("description"),
    capacity: formData.get("capacity") || undefined,
    hourly: formData.get("hourly"),
    halfDay: formData.get("halfDay"),
    fullDay: formData.get("fullDay"),
    minHours: formData.get("minHours"),
    requiresApproval: formData.get("requiresApproval") === "on",
    isBookable: formData.get("isBookable") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("rooms")
    .update({
      name: v.name,
      description: v.description || null,
      capacity: v.capacity ?? null,
      hourly_rate_cents: toCents(v.hourly),
      // An empty box means "no such rate", not zero — a room with a blank
      // half-day box shouldn't suddenly be bookable for nothing.
      half_day_rate_cents: v.halfDay ? toCents(v.halfDay) : null,
      full_day_rate_cents: v.fullDay ? toCents(v.fullDay) : null,
      min_hours: v.minHours,
      requires_approval: Boolean(v.requiresApproval),
      is_bookable: Boolean(v.isBookable),
    })
    .eq("id", v.roomId);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateRateViews();
  return { ok: true, message: "Rates updated." };
}

/* ---------------------------------------------------------------------------
   Counselling rate and tax
   --------------------------------------------------------------------------- */

const ratesSchema = z.object({
  counsellingHourly: z.coerce.number().min(0, "Rates can't be negative."),
  gstPercent: z.coerce.number().min(0).max(100),
});

export async function updateRates(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = ratesSchema.safeParse({
    counsellingHourly: formData.get("counsellingHourly"),
    gstPercent: formData.get("gstPercent"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("settings").upsert(
    {
      key: "rates",
      value: {
        counselling_hourly_cents: toCents(parsed.data.counsellingHourly),
        gst_rate: parsed.data.gstPercent / 100,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateRateViews();
  revalidatePath("/counselling");
  return { ok: true, message: "Saved." };
}
