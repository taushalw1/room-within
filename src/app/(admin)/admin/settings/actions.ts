"use server";

import { creditWarnings } from "@/lib/credits";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { toCents } from "@/lib/format";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  sendBookingConfirmed,
  sendCounsellingRequestAck,
  sendInvoiceReminder,
  sendWelcome,
} from "@/lib/email/send";

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

/* ---------------------------------------------------------------------------
   Previewing the emails
   --------------------------------------------------------------------------- */

/**
 * Sends one of the real templates to the signed-in admin, filled with example
 * details.
 *
 * Deliberately uses the same functions the app sends for real, rather than a
 * copy — a preview that renders its own version of the template proves
 * nothing about what tenants actually receive.
 */
export async function sendTestEmail(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isDemoMode) {
    return { ok: false, message: "Demo mode — connect the database first." };
  }
  if (!admin.email) {
    return { ok: false, message: "Your account has no email address." };
  }

  const which = String(formData.get("template") ?? "welcome");
  const to = admin.email;
  const name = admin.fullName ?? "there";

  const inThreeDays = new Date(Date.now() + 3 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const result =
    which === "reminder"
      ? await sendInvoiceReminder({
          to,
          name,
          invoiceNumber: "RW-000123",
          description: "Office 1 — monthly rent",
          dueDate: inThreeDays,
          balanceCents: 65000,
          daysOverdue: 0,
        })
      : which === "overdue"
        ? await sendInvoiceReminder({
            to,
            name,
            invoiceNumber: "RW-000123",
            description: "Office 1 — monthly rent",
            dueDate: new Date(Date.now() - 7 * 86_400_000)
              .toISOString()
              .slice(0, 10),
            balanceCents: 65000,
            daysOverdue: 7,
          })
        : which === "booking"
          ? await sendBookingConfirmed({
              to,
              name,
              roomName: "The Gathering Room",
              when: "Sat 12 Sep · 2:00–5:00 PM",
            })
          : which === "counselling"
            ? await sendCounsellingRequestAck({ to, name })
            : await sendWelcome({ to, name });

  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: `Sent to ${to}. Give it a minute.` };
}

/* ---------------------------------------------------------------------------
   Classes, credits and memberships
   --------------------------------------------------------------------------- */

const classSettingsSchema = z.object({
  hubSplitPercent: z.coerce.number().int().min(0).max(100),
  confirmHoursBefore: z.coerce.number().int().min(1).max(168),
  earnedAfterSessions: z.coerce.number().int().min(1).max(200),
  earnedMinAverage: z.coerce.number().min(0).max(200),
});

export async function updateClassSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = classSettingsSchema.safeParse({
    hubSplitPercent: formData.get("hubSplitPercent"),
    confirmHoursBefore: formData.get("confirmHoursBefore"),
    earnedAfterSessions: formData.get("earnedAfterSessions"),
    earnedMinAverage: formData.get("earnedMinAverage"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("settings").upsert(
    {
      key: "classes",
      value: {
        hub_split_percent: parsed.data.hubSplitPercent,
        confirm_hours_before: parsed.data.confirmHoursBefore,
        earned_after_sessions: parsed.data.earnedAfterSessions,
        earned_min_average_attendance: parsed.data.earnedMinAverage,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePath("/admin/classes");
  revalidatePath("/admin/instructors");
  revalidatePath("/classes");
  return {
    ok: true,
    message:
      "Saved. This applies to classes from now on — statements already marked paid don't move.",
  };
}

const creditSettingsSchema = z.object({
  individualPrice: z.coerce.number().min(0),
  individualCredits: z.coerce.number().int().min(0).max(100),
  familyPrice: z.coerce.number().min(0),
  familyCredits: z.coerce.number().int().min(0).max(100),
  extraCredit: z.coerce.number().min(0),
  dropin: z.coerce.number().min(0),
  rolloverMonths: z.coerce.number().int().min(0).max(24),
  familySameClassCap: z.coerce.number().int().min(0).max(100),
});

export async function updateCreditSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = creditSettingsSchema.safeParse({
    individualPrice: formData.get("individualPrice"),
    individualCredits: formData.get("individualCredits"),
    familyPrice: formData.get("familyPrice"),
    familyCredits: formData.get("familyCredits"),
    extraCredit: formData.get("extraCredit"),
    dropin: formData.get("dropin"),
    rolloverMonths: formData.get("rolloverMonths"),
    familySameClassCap: formData.get("familySameClassCap"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const value = {
    individual_price_cents: toCents(parsed.data.individualPrice),
    individual_credits: parsed.data.individualCredits,
    family_price_cents: toCents(parsed.data.familyPrice),
    family_credits: parsed.data.familyCredits,
    extra_credit_cents: toCents(parsed.data.extraCredit),
    dropin_cents: toCents(parsed.data.dropin),
    rollover_months: parsed.data.rolloverMonths,
    family_same_class_cap: parsed.data.familySameClassCap,
  };

  const { error } = await supabase.from("settings").upsert(
    { key: "credits", value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePath("/admin/members");
  revalidatePath("/classes");

  // Say so rather than let a quietly broken price sit there unnoticed.
  const warnings = creditWarnings(value);
  return {
    ok: true,
    message: warnings.length
      ? `Saved — but worth a look: ${warnings[0]}`
      : "Saved. Existing members keep their current price until you change theirs.",
  };
}

/* ---------------------------------------------------------------------------
   What the weekly search looks for
   --------------------------------------------------------------------------- */

const researchSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  profile: z.string().trim().min(40, "Say a bit more about the place — the search uses this to judge what fits."),
  grantNotes: z.string().trim().max(2000),
  conferenceNotes: z.string().trim().max(2000),
  maxResults: z.coerce.number().int().min(1).max(30),
});

export async function updateResearchSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = researchSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    profile: formData.get("profile"),
    grantNotes: formData.get("grantNotes"),
    conferenceNotes: formData.get("conferenceNotes"),
    maxResults: formData.get("maxResults"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("settings").upsert(
    {
      key: "research",
      value: {
        enabled: Boolean(parsed.data.enabled),
        profile: parsed.data.profile,
        grant_notes: parsed.data.grantNotes,
        conference_notes: parsed.data.conferenceNotes,
        max_results: parsed.data.maxResults,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePath("/admin/grants");
  revalidatePath("/admin/conferences");

  return {
    ok: true,
    message: parsed.data.enabled
      ? "Saved. The next Monday search will use this."
      : "Saved, and the weekly search is switched off.",
  };
}

const lateFeeSchema = z.object({
  enabled: z.boolean(),
  graceDays: z.coerce.number().int().min(0).max(60),
  kind: z.enum(["fixed", "percent"]),
  amount: z.coerce.number().min(0).max(1000),
  percent: z.coerce.number().min(0).max(25),
  max: z.coerce.number().min(0).max(5000),
  appliesToRent: z.boolean(),
  appliesToBookings: z.boolean(),
  appliesToOther: z.boolean(),
});

/**
 * Turn late fees on, or change what they are.
 *
 * The one setting in here with a person on the other end of it, so the
 * message it gives back says plainly what has just been switched on rather
 * than "Saved."
 */
export async function updateLateFeeSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = lateFeeSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    graceDays: formData.get("graceDays"),
    kind: formData.get("kind"),
    amount: formData.get("amount") || 0,
    percent: formData.get("percent") || 0,
    max: formData.get("max") || 0,
    appliesToRent: formData.get("appliesToRent") === "on",
    appliesToBookings: formData.get("appliesToBookings") === "on",
    appliesToOther: formData.get("appliesToOther") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const appliesTo = [
    ...(v.appliesToRent ? ["rent"] : []),
    ...(v.appliesToBookings ? ["booking"] : []),
    ...(v.appliesToOther ? ["other"] : []),
  ];

  if (v.enabled && appliesTo.length === 0) {
    return {
      ok: false,
      message: "Pick at least one kind of invoice a fee can apply to.",
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("settings").upsert(
    {
      key: "late_fees",
      value: {
        enabled: v.enabled,
        grace_days: v.graceDays,
        kind: v.kind,
        amount_cents: Math.round(v.amount * 100),
        percent: v.percent,
        max_cents: Math.round(v.max * 100),
        applies_to: appliesTo,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePath("/admin/settings");
  revalidatePath("/admin/rentals");

  return {
    ok: true,
    message: v.enabled
      ? `Saved. From tomorrow morning, an invoice still unpaid ${v.graceDays} days after it was due will get one fee added — once, not every month.`
      : "Saved, and no late fees will be charged.",
  };
}

/** Whether the morning note gets sent at all. */
export async function updateDigestSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const enabled = formData.get("enabled") === "on";

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase.from("settings").upsert(
    { key: "digest", value: { enabled }, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePath("/admin/settings");

  return {
    ok: true,
    message: enabled
      ? "Saved. It arrives first thing, and only on mornings there's something to say."
      : "Saved, and the morning note is switched off.",
  };
}
