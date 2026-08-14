"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { toCents } from "@/lib/format";
import { slugify, uniqueSlug } from "@/lib/slug";

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

/** The fields shared by adding a room and editing one. */
const roomFields = z.object({
  name: z.string().trim().min(2, "Give the room a name."),
  description: z.string().trim().max(1000).optional(),
  capacity: z.coerce.number().int().min(0).max(500).optional(),
  hourly: z.coerce.number().min(0, "Rates can't be negative."),
  halfDay: z.string().optional(),
  fullDay: z.string().optional(),
  minHours: z.coerce.number().min(0.25).max(12),
  requiresApproval: z.coerce.boolean().optional(),
  isBookable: z.coerce.boolean().optional(),
});

/** Applied to both, so a new room can't be created unpriced either. */
const pricedSomehow = {
  check: (v: z.infer<typeof roomFields>) =>
    v.hourly > 0 || Boolean(v.halfDay) || Boolean(v.fullDay),
  message: "Set at least one rate, or the room can't be priced.",
};

const roomSchema = roomFields
  .extend({ roomId: z.string().min(1) })
  .refine(pricedSomehow.check, { message: pricedSomehow.message });

const newRoomSchema = roomFields.refine(pricedSomehow.check, {
  message: pricedSomehow.message,
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
   Adding a room
   --------------------------------------------------------------------------- */

export async function createRoom(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = newRoomSchema.safeParse({
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

  // The slug is the room's web address, so it has to be unique.
  const { data: existing } = await supabase.from("rooms").select("slug, sort_order");
  const slug = uniqueSlug(
    slugify(v.name) || "room",
    (existing ?? []).map((r) => r.slug as string),
  );
  const nextOrder =
    Math.max(0, ...(existing ?? []).map((r) => (r.sort_order as number) ?? 0)) + 1;

  const { error } = await supabase.from("rooms").insert({
    name: v.name,
    slug,
    description: v.description || null,
    capacity: v.capacity ?? null,
    hourly_rate_cents: toCents(v.hourly),
    half_day_rate_cents: v.halfDay ? toCents(v.halfDay) : null,
    full_day_rate_cents: v.fullDay ? toCents(v.fullDay) : null,
    min_hours: v.minHours,
    requires_approval: Boolean(v.requiresApproval),
    is_bookable: Boolean(v.isBookable),
    sort_order: nextOrder,
  });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateRateViews();
  return {
    ok: true,
    message: v.isBookable
      ? `${v.name} added, and it's now on the website.`
      : `${v.name} added. Tick "show on the website" when you're ready.`,
  };
}

/* ---------------------------------------------------------------------------
   Units — the parts of the building let on a monthly lease
   --------------------------------------------------------------------------- */

const unitSchema = z.object({
  name: z.string().trim().min(2, "Give the unit a name."),
  kind: z.enum(["office", "suite", "retail", "storage", "other"]),
  floor: z.string().trim().max(40).optional(),
  description: z.string().trim().max(1000).optional(),
  monthlyRate: z.coerce.number().min(0, "Rent can't be negative."),
  isActive: z.coerce.boolean().optional(),
});

function readUnitForm(formData: FormData) {
  return unitSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") || "office",
    floor: formData.get("floor"),
    description: formData.get("description"),
    monthlyRate: formData.get("monthlyRate"),
    isActive: formData.get("isActive") === "on",
  });
}

function unitRow(v: z.infer<typeof unitSchema>) {
  return {
    name: v.name,
    kind: v.kind,
    floor: v.floor || null,
    description: v.description || null,
    monthly_rate_cents: toCents(v.monthlyRate),
    is_active: Boolean(v.isActive),
  };
}

function revalidateUnitViews() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/rentals");
  revalidatePath("/admin/contacts");
  revalidatePath("/admin");
}

export async function createUnit(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = readUnitForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { data: existing } = await supabase.from("units").select("sort_order");
  const nextOrder =
    Math.max(0, ...(existing ?? []).map((u) => (u.sort_order as number) ?? 0)) + 1;

  const { error } = await supabase
    .from("units")
    .insert({ ...unitRow(parsed.data), sort_order: nextOrder });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateUnitViews();
  return {
    ok: true,
    message: `${parsed.data.name} added. You can let it from the Rentals page.`,
  };
}

export async function updateUnit(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("unitId") ?? "");
  if (!id) return { ok: false, message: "Missing unit." };

  const parsed = readUnitForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("units")
    .update(unitRow(parsed.data))
    .eq("id", id);

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidateUnitViews();
  return {
    ok: true,
    message:
      "Unit updated. This is the default rent — tenancies already agreed keep their own figure.",
  };
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
