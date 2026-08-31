"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { getClassSettings } from "@/lib/data/classes";
import { buildStatement, earnedStanding, sessionMoney } from "@/lib/classes";
import type {
  ClassRow,
  ClassSessionRow,
  EnrolmentRow,
  EquipmentRow,
  InstructorRow,
  StorageRentalRow,
} from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh() {
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/classes");
  revalidatePath("/admin/finance");
  revalidatePath("/classes");
}

const money = (dollars: unknown) => Math.round(Number(dollars ?? 0) * 100);

/* ------------------------------ Instructors ------------------------------- */

const instructorSchema = z.object({
  displayName: z.string().trim().min(2, "What is their name?"),
  contactId: z.string().optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  guaranteedPay: z.coerce.number().min(0).max(1000),
  splitPercent: z.union([z.coerce.number().int().min(0).max(100), z.literal("")]).optional(),
  agreementSignedOn: z.string().optional(),
  waiverSignedOn: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.coerce.boolean().optional(),
});

function readInstructor(formData: FormData) {
  return instructorSchema.safeParse({
    displayName: formData.get("displayName"),
    contactId: formData.get("contactId") || undefined,
    headline: formData.get("headline"),
    bio: formData.get("bio"),
    guaranteedPay: formData.get("guaranteedPay") || 0,
    splitPercent: formData.get("splitPercent") || "",
    agreementSignedOn: formData.get("agreementSignedOn") || undefined,
    waiverSignedOn: formData.get("waiverSignedOn") || undefined,
    notes: formData.get("notes"),
    isActive: formData.get("isActive") === "on",
  });
}

function instructorRecord(v: z.infer<typeof instructorSchema>) {
  return {
    display_name: v.displayName,
    contact_id: v.contactId || null,
    headline: v.headline || null,
    bio: v.bio || null,
    guaranteed_pay_cents: money(v.guaranteedPay),
    split_percent: v.splitPercent === "" || v.splitPercent == null ? null : v.splitPercent,
    agreement_signed_on: v.agreementSignedOn || null,
    waiver_signed_on: v.waiverSignedOn || null,
    notes: v.notes || null,
    is_active: Boolean(v.isActive),
  };
}

export async function addInstructor(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = readInstructor(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("instructors")
    .insert(instructorRecord(parsed.data));
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Instructor added." };
}

export async function updateInstructor(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("instructorId") ?? "");
  const parsed = readInstructor(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("instructors")
    .update(instructorRecord(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Instructor updated." };
}

/**
 * Recompute standing for everyone.
 *
 * Deliberately a calculation over the record, not a decision: it can be run
 * again at any time and will always give the same answer, which is what makes
 * it defensible when somebody asks why they haven't been promoted.
 */
export async function refreshStandings(): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const settings = await getClassSettings();

  const [{ data: instructorData }, { data: classData }, { data: sessionData }] =
    await Promise.all([
      supabase.from("instructors").select("*"),
      supabase.from("classes").select("id, instructor_id"),
      supabase.from("class_sessions").select("id, class_id, status"),
    ]);

  const instructors = (instructorData as InstructorRow[] | null) ?? [];
  const classes = (classData as { id: string; instructor_id: string | null }[] | null) ?? [];
  const sessions =
    (sessionData as { id: string; class_id: string; status: string }[] | null) ?? [];

  const classOwner = new Map(classes.map((c) => [c.id, c.instructor_id]));

  const { data: enrolData } = await supabase
    .from("enrolments")
    .select("session_id, attended, cancelled_at");
  const enrolments =
    (enrolData as
      | { session_id: string; attended: boolean | null; cancelled_at: string | null }[]
      | null) ?? [];

  const attendedBySession = new Map<string, number>();
  for (const e of enrolments) {
    if (e.cancelled_at || e.attended === false) continue;
    attendedBySession.set(e.session_id, (attendedBySession.get(e.session_id) ?? 0) + 1);
  }

  let promoted = 0;

  for (const instructor of instructors) {
    const theirs = sessions.filter(
      (s) => classOwner.get(s.class_id) === instructor.id,
    );
    const delivered = theirs.filter((s) => s.status === "delivered");
    const cancelled = theirs.filter((s) => s.status === "cancelled");

    const heads = delivered.reduce(
      (sum, s) => sum + (attendedBySession.get(s.id) ?? 0),
      0,
    );
    const average = delivered.length ? heads / delivered.length : 0;

    const { earned } = earnedStanding(
      delivered.length,
      average,
      cancelled.length,
      settings,
    );

    if (earned && instructor.standing !== "earned") {
      await supabase
        .from("instructors")
        .update({ standing: "earned", earned_at: new Date().toISOString() })
        .eq("id", instructor.id);
      promoted++;
    }
  }

  refresh();
  return {
    ok: true,
    message: promoted
      ? `${promoted} instructor${promoted === 1 ? "" : "s"} reached earned standing.`
      : "Everyone's standing is already up to date.",
  };
}

/* ------------------------------- Equipment -------------------------------- */

const equipmentSchema = z.object({
  name: z.string().trim().min(2, "What is it called?"),
  description: z.string().trim().max(300).optional(),
  quantity: z.coerce.number().int().min(1).max(500),
  sessionRate: z.coerce.number().min(0),
  isActive: z.coerce.boolean().optional(),
});

export async function saveEquipment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = equipmentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    quantity: formData.get("quantity") || 1,
    sessionRate: formData.get("sessionRate") || 0,
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const record = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    quantity: parsed.data.quantity,
    session_rate_cents: money(parsed.data.sessionRate),
    is_active: Boolean(parsed.data.isActive),
  };

  const id = String(formData.get("equipmentId") ?? "");
  const { error } = id
    ? await supabase.from("equipment").update(record).eq("id", id)
    : await supabase.from("equipment").insert(record);

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: id ? "Equipment updated." : "Equipment added." };
}

export async function deleteEquipment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("equipment")
    .delete()
    .eq("id", String(formData.get("equipmentId") ?? ""));
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Equipment removed." };
}

/* -------------------------------- Storage --------------------------------- */

const storageSchema = z.object({
  instructorId: z.string().min(1, "Whose storage is it?"),
  label: z.string().trim().min(2, "Where is it?"),
  size: z.enum(["shelf", "locker", "closet", "corner", "room"]),
  monthlyRate: z.coerce.number().min(0),
  startedOn: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Choose a start date."),
  endedOn: z.string().optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function saveStorage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = storageSchema.safeParse({
    instructorId: formData.get("instructorId"),
    label: formData.get("label"),
    size: formData.get("size") || "shelf",
    monthlyRate: formData.get("monthlyRate") || 0,
    startedOn: formData.get("startedOn"),
    endedOn: formData.get("endedOn") || undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const record = {
    instructor_id: parsed.data.instructorId,
    label: parsed.data.label,
    size: parsed.data.size,
    monthly_rate_cents: money(parsed.data.monthlyRate),
    started_on: parsed.data.startedOn,
    ended_on: parsed.data.endedOn || null,
    notes: parsed.data.notes || null,
  };

  const id = String(formData.get("storageId") ?? "");
  const { error } = id
    ? await supabase.from("storage_rentals").update(record).eq("id", id)
    : await supabase.from("storage_rentals").insert(record);

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: id ? "Storage updated." : "Storage let." };
}

export async function endStorage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("storage_rentals")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("id", String(formData.get("storageId") ?? ""));
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Storage ended. It stops being billed next month." };
}

/* ------------------------------- Statements -------------------------------- */

/**
 * Work out every instructor's month and save it.
 *
 * A statement is stored rather than always recomputed, because once somebody
 * has been paid against a figure, that figure must not move if a session is
 * later edited. Draft statements are overwritten; paid ones are left alone.
 */
export async function buildStatements(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const monthValue = String(formData.get("period") ?? "");
  const period = monthValue
    ? new Date(`${monthValue}-01T00:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  if (Number.isNaN(period.getTime())) {
    return { ok: false, message: "Which month?" };
  }

  const monthStart = new Date(period.getFullYear(), period.getMonth(), 1);
  const monthEnd = new Date(period.getFullYear(), period.getMonth() + 1, 1);

  const settings = await getClassSettings();

  const [
    { data: instructorData },
    { data: classData },
    { data: sessionData },
    { data: storageData },
    { data: equipmentData },
    { data: classEquipmentData },
  ] = await Promise.all([
    supabase.from("instructors").select("*"),
    supabase.from("classes").select("*"),
    supabase
      .from("class_sessions")
      .select("*")
      .gte("starts_at", monthStart.toISOString())
      .lt("starts_at", monthEnd.toISOString()),
    supabase.from("storage_rentals").select("*"),
    supabase.from("equipment").select("*"),
    supabase.from("class_equipment").select("class_id, equipment_id, quantity"),
  ]);

  const instructors = (instructorData as InstructorRow[] | null) ?? [];
  const classes = (classData as ClassRow[] | null) ?? [];
  const sessions = (sessionData as ClassSessionRow[] | null) ?? [];
  const storage = (storageData as StorageRentalRow[] | null) ?? [];
  const equipment = (equipmentData as EquipmentRow[] | null) ?? [];

  if (!sessions.length) {
    return { ok: false, message: "No sessions ran in that month." };
  }

  const equipmentById = new Map(equipment.map((e) => [e.id, e]));
  const perClassEquipment = new Map<
    string,
    { equipment: EquipmentRow; quantity: number }[]
  >();
  for (const row of (classEquipmentData as
    | { class_id: string; equipment_id: string; quantity: number }[]
    | null) ?? []) {
    const item = equipmentById.get(row.equipment_id);
    if (!item) continue;
    const list = perClassEquipment.get(row.class_id) ?? [];
    list.push({ equipment: item, quantity: row.quantity });
    perClassEquipment.set(row.class_id, list);
  }

  const { data: enrolData } = await supabase
    .from("enrolments")
    .select("*")
    .in("session_id", sessions.map((s) => s.id));
  const enrolments = (enrolData as EnrolmentRow[] | null) ?? [];

  const classById = new Map(classes.map((c) => [c.id, c]));
  let written = 0;
  let skipped = 0;

  for (const instructor of instructors) {
    const theirSessions = sessions
      .filter((s) => classById.get(s.class_id)?.instructor_id === instructor.id)
      .map((session) => {
        const klass = classById.get(session.class_id)!;
        return {
          session,
          klass,
          money: sessionMoney(
            klass,
            enrolments.filter((e) => e.session_id === session.id),
            {
              settings,
              instructor,
              equipment: perClassEquipment.get(klass.id),
            },
          ),
        };
      });

    if (!theirSessions.some((s) => s.session.status === "delivered")) continue;

    const draft = buildStatement({
      instructor,
      period: monthStart,
      sessions: theirSessions,
      storage: storage.filter((s) => s.instructor_id === instructor.id),
    });

    const { data: existing } = await supabase
      .from("instructor_statements")
      .select("id, status")
      .eq("instructor_id", instructor.id)
      .eq("period", draft.period)
      .maybeSingle();

    if (existing?.status === "paid") {
      skipped++;
      continue;
    }

    const record = {
      instructor_id: draft.instructorId,
      period: draft.period,
      class_revenue_cents: draft.classRevenueCents,
      instructor_share_cents: draft.instructorShareCents,
      equipment_cents: draft.equipmentCents,
      storage_cents: draft.storageCents,
      guaranteed_cents: draft.guaranteedCents,
      materials_cents: draft.materialsCents,
      net_payout_cents: draft.netPayoutCents,
      sessions_delivered: draft.sessionsDelivered,
    };

    if (existing) {
      await supabase
        .from("instructor_statements")
        .update(record)
        .eq("id", existing.id as string);
    } else {
      await supabase.from("instructor_statements").insert(record);
    }
    written++;
  }

  refresh();

  if (!written && !skipped) {
    return { ok: false, message: "Nothing was delivered that month." };
  }
  return {
    ok: true,
    message: skipped
      ? `${written} statement${written === 1 ? "" : "s"} prepared. ${skipped} left alone — already marked paid.`
      : `${written} statement${written === 1 ? "" : "s"} prepared.`,
  };
}

export async function markStatementPaid(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("instructor_statements")
    .update({ status: "paid", paid_on: new Date().toISOString().slice(0, 10) })
    .eq("id", String(formData.get("statementId") ?? ""));

  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message: "Marked paid. The figures are now fixed and won't be recalculated.",
  };
}
