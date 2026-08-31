"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { getClassSettings } from "@/lib/data/classes";
import { sessionDecision, subsidyFor } from "@/lib/classes";
import type { ClassRow, ClassSessionRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};

const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh() {
  revalidatePath("/admin/classes");
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/finance");
  revalidatePath("/classes");
  revalidatePath("/calendar");
}

const money = (dollars: unknown) => Math.round(Number(dollars ?? 0) * 100);

/* ------------------------------ Add a class ------------------------------- */

const classSchema = z.object({
  title: z.string().trim().min(2, "What is the class called?"),
  instructorId: z.string().optional(),
  roomId: z.string().optional(),
  summary: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  sessionMinutes: z.coerce.number().int().min(15).max(600),
  capacity: z.coerce.number().int().min(1).max(200),
  fullPrice: z.coerce.number().min(0),
  reducedPrice: z.coerce.number().min(0),
  subsidizedPrice: z.coerce.number().min(0),
  subsidizedSeatCap: z.coerce.number().int().min(0).max(200),
  creditCost: z.coerce.number().int().min(0).max(10),
  materialsCost: z.coerce.number().min(0),
  materialsNote: z.string().trim().max(300).optional(),
  minHeadcount: z.coerce.number().int().min(0).max(200),
  isPublic: z.coerce.boolean().optional(),
  status: z.enum(["draft", "open", "full", "finished", "cancelled"]),
});

function readClassForm(formData: FormData) {
  return classSchema.safeParse({
    title: formData.get("title"),
    instructorId: formData.get("instructorId") || undefined,
    roomId: formData.get("roomId") || undefined,
    summary: formData.get("summary"),
    description: formData.get("description"),
    sessionMinutes: formData.get("sessionMinutes"),
    capacity: formData.get("capacity"),
    fullPrice: formData.get("fullPrice"),
    reducedPrice: formData.get("reducedPrice"),
    subsidizedPrice: formData.get("subsidizedPrice"),
    subsidizedSeatCap: formData.get("subsidizedSeatCap"),
    creditCost: formData.get("creditCost"),
    materialsCost: formData.get("materialsCost"),
    materialsNote: formData.get("materialsNote"),
    minHeadcount: formData.get("minHeadcount"),
    isPublic: formData.get("isPublic") === "on",
    status: formData.get("status") || "draft",
  });
}

function classRecord(v: z.infer<typeof classSchema>) {
  return {
    title: v.title,
    instructor_id: v.instructorId || null,
    room_id: v.roomId || null,
    summary: v.summary || null,
    description: v.description || null,
    session_minutes: v.sessionMinutes,
    capacity: v.capacity,
    full_price_cents: money(v.fullPrice),
    reduced_price_cents: money(v.reducedPrice),
    subsidized_price_cents: money(v.subsidizedPrice),
    subsidized_seat_cap: v.subsidizedSeatCap,
    credit_cost: v.creditCost,
    materials_cost_cents: money(v.materialsCost),
    materials_note: v.materialsNote || null,
    min_headcount: v.minHeadcount,
    is_public: Boolean(v.isPublic),
    status: v.status,
  };
}

/** Prices have to descend, or the sliding scale isn't a scale. */
function priceOrderProblem(v: z.infer<typeof classSchema>): string | null {
  if (v.reducedPrice > v.fullPrice) {
    return "The reduced price is higher than the full price.";
  }
  if (v.subsidizedPrice > v.reducedPrice) {
    return "The subsidized price is higher than the reduced price.";
  }
  return null;
}

export async function addClass(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = readClassForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const problem = priceOrderProblem(parsed.data);
  if (problem) return { ok: false, message: problem };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("classes").insert(classRecord(parsed.data));
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Class added." };
}

export async function updateClass(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("classId") ?? "");
  if (!id) return { ok: false, message: "Which class?" };

  const parsed = readClassForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const problem = priceOrderProblem(parsed.data);
  if (problem) return { ok: false, message: problem };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("classes")
    .update(classRecord(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Class updated." };
}

export async function deleteClass(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", String(formData.get("classId") ?? ""));
  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Class removed, along with its sessions." };
}

/* ------------------------------- Sessions --------------------------------- */

const sessionSchema = z.object({
  classId: z.string().min(1),
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Choose a date."),
  startTime: z.string().regex(/^[0-9]{2}:[0-9]{2}$/, "Choose a start time."),
  repeatWeeks: z.coerce.number().int().min(1).max(52),
});

/**
 * Add a run of sessions.
 *
 * Classes here are taught in blocks — eight weeks of the arts club, not eight
 * separate decisions — so the form schedules the whole block at once.
 */
export async function addSessions(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = sessionSchema.safeParse({
    classId: formData.get("classId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    repeatWeeks: formData.get("repeatWeeks") || 1,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { data: klass } = await supabase
    .from("classes")
    .select("session_minutes")
    .eq("id", parsed.data.classId)
    .single();

  const minutes = (klass?.session_minutes as number) ?? 90;
  const first = new Date(`${parsed.data.date}T${parsed.data.startTime}:00`);
  if (Number.isNaN(first.getTime())) {
    return { ok: false, message: "That date and time didn't make sense." };
  }

  const rows = Array.from({ length: parsed.data.repeatWeeks }, (_, i) => {
    const starts = new Date(first.getTime() + i * 7 * 86_400_000);
    return {
      class_id: parsed.data.classId,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + minutes * 60_000).toISOString(),
    };
  });

  const { error } = await supabase.from("class_sessions").insert(rows);
  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message:
      rows.length === 1
        ? "Session added."
        : `${rows.length} weekly sessions added.`,
  };
}

export async function cancelSession(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const { error } = await supabase
    .from("class_sessions")
    .update({
      status: "cancelled",
      decided_at: new Date().toISOString(),
      cancel_reason: reason || "Cancelled by the hub.",
    })
    .eq("id", sessionId);

  if (error) return { ok: false, message: error.message };

  const returned = await returnCreditsFor(sessionId);
  refresh();

  return {
    ok: true,
    message: returned
      ? `Session cancelled, and ${returned} credit${returned === 1 ? "" : "s"} went back to members.`
      : "Session cancelled.",
  };
}

/** Give back every credit spent on a session that isn't going to happen. */
async function returnCreditsFor(sessionId: string): Promise<number> {
  const supabase = await getServerSupabase();
  if (!supabase) return 0;

  const { data: spends } = await supabase
    .from("credit_ledger")
    .select("membership_id, delta")
    .eq("session_id", sessionId)
    .eq("reason", "spent");

  const rows = (spends as { membership_id: string; delta: number }[] | null) ?? [];
  if (!rows.length) return 0;

  await supabase.from("credit_ledger").insert(
    rows.map((r) => ({
      membership_id: r.membership_id,
      delta: -r.delta,
      reason: "refund" as const,
      session_id: sessionId,
      note: "Class cancelled",
    })),
  );

  return rows.reduce((s, r) => s + -r.delta, 0);
}

/**
 * Apply the confirm-or-cancel rule to every session that's still waiting.
 *
 * This is the same routine the nightly job runs. Having a button for it means
 * the rule can be watched working rather than taken on trust.
 */
export async function runSessionDecisions(): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const settings = await getClassSettings();
  const now = new Date();

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("*")
    .eq("status", "scheduled")
    .gte("starts_at", new Date(now.getTime() - 86_400_000).toISOString());

  const list = (sessions as ClassSessionRow[] | null) ?? [];
  if (!list.length) return { ok: true, message: "Nothing waiting on a decision." };

  const { data: classData } = await supabase.from("classes").select("*");
  const classes = new Map(
    ((classData as ClassRow[] | null) ?? []).map((c) => [c.id, c]),
  );

  const { data: enrolData } = await supabase
    .from("enrolments")
    .select("session_id, cancelled_at")
    .in("session_id", list.map((s) => s.id));

  const heads = new Map<string, number>();
  for (const e of (enrolData as
    | { session_id: string; cancelled_at: string | null }[]
    | null) ?? []) {
    if (e.cancelled_at) continue;
    heads.set(e.session_id, (heads.get(e.session_id) ?? 0) + 1);
  }

  let confirmed = 0;
  let cancelled = 0;

  for (const session of list) {
    const klass = classes.get(session.class_id);
    if (!klass) continue;

    const decision = sessionDecision(
      klass,
      session,
      heads.get(session.id) ?? 0,
      settings,
      now,
    );

    if (decision === "confirm") {
      await supabase
        .from("class_sessions")
        .update({ status: "confirmed", decided_at: now.toISOString() })
        .eq("id", session.id);
      confirmed++;
    } else if (decision === "cancel") {
      await supabase
        .from("class_sessions")
        .update({
          status: "cancelled",
          decided_at: now.toISOString(),
          cancel_reason: `Fewer than ${klass.min_headcount} people signed up.`,
        })
        .eq("id", session.id);
      await returnCreditsFor(session.id);
      cancelled++;
    }
  }

  refresh();

  if (!confirmed && !cancelled) {
    return { ok: true, message: "Nothing needed deciding yet." };
  }
  return {
    ok: true,
    message: `${confirmed} confirmed, ${cancelled} cancelled for want of numbers.`,
  };
}

/* ------------------------------ Attendance -------------------------------- */

/**
 * Record who came, and close the session off.
 *
 * Marking a session delivered is what turns credits into income and puts money
 * on an instructor's statement, so it happens once, deliberately.
 */
export async function recordAttendance(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return { ok: false, message: "Which session?" };

  const { data: enrolData } = await supabase
    .from("enrolments")
    .select("id")
    .eq("session_id", sessionId)
    .is("cancelled_at", null);

  const ids = ((enrolData as { id: string }[] | null) ?? []).map((e) => e.id);

  let present = 0;
  for (const id of ids) {
    const attended = formData.get(`attended:${id}`) === "on";
    if (attended) present++;
    await supabase.from("enrolments").update({ attended }).eq("id", id);
  }

  const { error } = await supabase
    .from("class_sessions")
    .update({
      status: "delivered",
      attendance_recorded_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) return { ok: false, message: error.message };

  refresh();
  return {
    ok: true,
    message: `${present} of ${ids.length} marked present. This session now counts towards the instructor's statement.`,
  };
}

/* ------------------------- Adding someone by hand -------------------------- */

const enrolSchema = z.object({
  sessionId: z.string().min(1),
  attendeeName: z.string().trim().min(2, "Who is coming?"),
  attendeeEmail: z.string().trim().email().optional().or(z.literal("")),
  tier: z.enum(["full", "reduced", "subsidized"]),
  method: z.enum(["cash", "credit"]),
  membershipId: z.string().optional(),
});

export async function addEnrolment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = enrolSchema.safeParse({
    sessionId: formData.get("sessionId"),
    attendeeName: formData.get("attendeeName"),
    attendeeEmail: formData.get("attendeeEmail") || "",
    tier: formData.get("tier") || "full",
    method: formData.get("method") || "cash",
    membershipId: formData.get("membershipId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { data: session } = await supabase
    .from("class_sessions")
    .select("class_id, status")
    .eq("id", v.sessionId)
    .single();

  if (!session) return { ok: false, message: "That session no longer exists." };
  if (session.status === "cancelled") {
    return { ok: false, message: "That session was cancelled." };
  }

  const { data: classData } = await supabase
    .from("classes")
    .select("*")
    .eq("id", session.class_id as string)
    .single();

  const klass = classData as ClassRow | null;
  if (!klass) return { ok: false, message: "That class no longer exists." };

  const { count } = await supabase
    .from("enrolments")
    .select("id", { count: "exact", head: true })
    .eq("session_id", v.sessionId)
    .is("cancelled_at", null);

  if ((count ?? 0) >= klass.capacity) {
    return { ok: false, message: "That session is full." };
  }

  if (v.method === "credit" && !v.membershipId) {
    return { ok: false, message: "Which membership are the credits coming from?" };
  }

  const price =
    v.tier === "reduced"
      ? klass.reduced_price_cents
      : v.tier === "subsidized"
        ? klass.subsidized_price_cents
        : klass.full_price_cents;

  const { error } = await supabase.from("enrolments").insert({
    session_id: v.sessionId,
    attendee_name: v.attendeeName,
    attendee_email: v.attendeeEmail || null,
    tier: v.tier,
    method: v.method,
    credits_spent: v.method === "credit" ? klass.credit_cost : 0,
    paid_cents: v.method === "credit" ? 0 : price,
    subsidy_cents: v.method === "credit" ? klass.full_price_cents : subsidyFor(klass, v.tier),
  });

  if (error) return { ok: false, message: error.message };

  if (v.method === "credit" && v.membershipId) {
    await supabase.from("credit_ledger").insert({
      membership_id: v.membershipId,
      delta: -klass.credit_cost,
      reason: "spent",
      session_id: v.sessionId,
      note: klass.title,
    });
  }

  refresh();
  return { ok: true, message: `${v.attendeeName} added to the list.` };
}

export async function removeEnrolment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("enrolments")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", String(formData.get("enrolmentId") ?? ""));

  if (error) return { ok: false, message: error.message };

  refresh();
  return { ok: true, message: "Taken off the list." };
}
