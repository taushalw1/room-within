import { getServiceSupabase } from "@/lib/supabase/server";
import { DEFAULT_CLASS_SETTINGS, sessionDecision } from "@/lib/classes";
import {
  DEFAULT_CREDIT_SETTINGS,
  expiryFor,
  periodOf,
} from "@/lib/credits";
import { sendClassCancelled } from "@/lib/email/send";
import { dateTimeRange } from "@/lib/format";
import type {
  ClassRow,
  ClassSessionRow,
  ClassSettings,
  CreditSettings,
  MembershipRow,
} from "@/lib/data/types";

/**
 * The two rules that are supposed to run without anybody deciding anything.
 *
 *   1. Confirm a session that has its numbers; cancel one that doesn't, and
 *      give the credits back.
 *   2. Grant each active membership its monthly credits.
 *
 * Both run daily rather than on a schedule tied to the thing they do. A missed
 * day costs nothing because both are idempotent — the credit grant is guarded
 * by a unique index, and a session is only decided once — whereas a monthly
 * job that failed quietly would skip a month and nobody would notice.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Fail closed in production: this cancels real classes and emails people.
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set — refusing to run.");
      return new Response("Not configured", { status: 503 });
    }
  } else if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return Response.json({ ok: false, reason: "no database" });

  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["classes", "credits"]);

  const rows = (settingsRows as { key: string; value: unknown }[] | null) ?? [];
  const classSettings: ClassSettings = {
    ...DEFAULT_CLASS_SETTINGS,
    ...((rows.find((r) => r.key === "classes")?.value as ClassSettings) ?? {}),
  };
  const creditSettings: CreditSettings = {
    ...DEFAULT_CREDIT_SETTINGS,
    ...((rows.find((r) => r.key === "credits")?.value as CreditSettings) ?? {}),
  };

  const decisions = await decideSessions(supabase, classSettings);
  const credits = await grantCredits(supabase, creditSettings);

  console.log(
    `Classes: confirmed ${decisions.confirmed}, cancelled ${decisions.cancelled}; credits granted to ${credits.granted}`,
  );

  return Response.json({ ok: true, ...decisions, ...credits });
}

type Supabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

async function decideSessions(supabase: Supabase, settings: ClassSettings) {
  const now = new Date();

  const { data: sessionData } = await supabase
    .from("class_sessions")
    .select("*")
    .eq("status", "scheduled")
    .gte("starts_at", now.toISOString());

  const sessions = (sessionData as ClassSessionRow[] | null) ?? [];
  if (!sessions.length) return { confirmed: 0, cancelled: 0 };

  const { data: classData } = await supabase.from("classes").select("*");
  const classes = new Map(
    ((classData as ClassRow[] | null) ?? []).map((c) => [c.id, c]),
  );

  const { data: enrolData } = await supabase
    .from("enrolments")
    .select("session_id, attendee_name, attendee_email, cancelled_at")
    .in(
      "session_id",
      sessions.map((s) => s.id),
    );

  const attendees = new Map<
    string,
    { attendee_name: string; attendee_email: string | null }[]
  >();
  for (const e of (enrolData as
    | {
        session_id: string;
        attendee_name: string;
        attendee_email: string | null;
        cancelled_at: string | null;
      }[]
    | null) ?? []) {
    if (e.cancelled_at) continue;
    const list = attendees.get(e.session_id) ?? [];
    list.push({ attendee_name: e.attendee_name, attendee_email: e.attendee_email });
    attendees.set(e.session_id, list);
  }

  let confirmed = 0;
  let cancelled = 0;

  for (const session of sessions) {
    const klass = classes.get(session.class_id);
    if (!klass) continue;

    const list = attendees.get(session.id) ?? [];
    const decision = sessionDecision(
      klass,
      session,
      list.length,
      settings,
      now,
    );

    if (decision === "confirm") {
      await supabase
        .from("class_sessions")
        .update({ status: "confirmed", decided_at: now.toISOString() })
        .eq("id", session.id);
      confirmed++;
      continue;
    }

    if (decision !== "cancel") continue;

    await supabase
      .from("class_sessions")
      .update({
        status: "cancelled",
        decided_at: now.toISOString(),
        cancel_reason: `Fewer than ${klass.min_headcount} people signed up.`,
      })
      .eq("id", session.id);

    // Credits go back before anybody is told, so the email is already true.
    const { data: spends } = await supabase
      .from("credit_ledger")
      .select("membership_id, delta")
      .eq("session_id", session.id)
      .eq("reason", "spent");

    const refunds =
      (spends as { membership_id: string; delta: number }[] | null) ?? [];
    if (refunds.length) {
      await supabase.from("credit_ledger").insert(
        refunds.map((r) => ({
          membership_id: r.membership_id,
          delta: -r.delta,
          reason: "refund" as const,
          session_id: session.id,
          note: "Class cancelled",
        })),
      );
    }

    const when = dateTimeRange(session.starts_at, session.ends_at);
    for (const person of list) {
      if (!person.attendee_email) continue;
      await sendClassCancelled({
        to: person.attendee_email,
        name: person.attendee_name,
        className: klass.title,
        when,
        refunded: refunds.length > 0,
      });
    }

    cancelled++;
  }

  return { confirmed, cancelled };
}

async function grantCredits(supabase: Supabase, settings: CreditSettings) {
  const now = new Date();
  const period = periodOf(now);
  const expires = expiryFor(now, settings);

  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("status", "active");

  const memberships = (data as MembershipRow[] | null) ?? [];
  let granted = 0;

  for (const membership of memberships) {
    if (membership.credits_per_month <= 0) continue;

    const { error } = await supabase.from("credit_ledger").insert({
      membership_id: membership.id,
      delta: membership.credits_per_month,
      reason: "monthly",
      period,
      expires_on: expires,
    });

    // 23505 is the one-grant-per-period index — an expected, quiet skip.
    if (!error) granted++;
    else if (error.code !== "23505") {
      console.error(`Credit grant failed for ${membership.id}: ${error.message}`);
    }
  }

  return { granted };
}
