"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getCreditSettings } from "@/lib/data/classes";
import { creditBalance, sameClassCapReached } from "@/lib/credits";
import { notifyAdmin, sendClassSignup } from "@/lib/email/send";
import { dateTimeRange } from "@/lib/format";
import { site } from "@/lib/site";
import type { ClassRow, CreditLedgerRow, MembershipRow } from "@/lib/data/types";

export type SignUpResult = { ok: boolean; message: string };

/**
 * Sign up for a class session.
 *
 * Members spend credits; everyone else pays on the night. Nobody is charged a
 * card here — the sliding scale means the amount is chosen by the attendee,
 * and taking money up front for a class that might not reach its minimum
 * would only create refunds.
 */
const schema = z.object({
  sessionId: z.string().min(1),
  name: z.string().trim().min(2, "What name should we put down?"),
  email: z.string().trim().email("That email address doesn't look right."),
  phone: z.string().trim().max(40).optional(),
  tier: z.enum(["full", "reduced", "subsidized"]),
  useCredits: z.coerce.boolean().optional(),
});

export async function signUpForClass(
  _prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  const parsed = schema.safeParse({
    sessionId: formData.get("sessionId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    tier: formData.get("tier") || "full",
    useCredits: formData.get("useCredits") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await getServerSupabase();
  if (!supabase) {
    return {
      ok: false,
      message: `Sign-ups aren't switched on yet. Please email ${site.email} and we'll put you down.`,
    };
  }

  const { data: sessionData } = await supabase
    .from("class_sessions")
    .select("id, class_id, starts_at, ends_at, status")
    .eq("id", v.sessionId)
    .single();

  if (!sessionData) return { ok: false, message: "That session has gone." };
  if (sessionData.status === "cancelled") {
    return { ok: false, message: "That session was cancelled." };
  }

  const { data: classData } = await supabase
    .from("classes")
    .select(
      "id, title, capacity, credit_cost, full_price_cents, reduced_price_cents, subsidized_price_cents, subsidized_seat_cap",
    )
    .eq("id", sessionData.class_id as string)
    .single();

  const klass = classData as Pick<
    ClassRow,
    | "id"
    | "title"
    | "capacity"
    | "credit_cost"
    | "full_price_cents"
    | "reduced_price_cents"
    | "subsidized_price_cents"
    | "subsidized_seat_cap"
  > | null;

  if (!klass) return { ok: false, message: "That class has gone." };

  const { count } = await supabase
    .from("enrolments")
    .select("id", { count: "exact", head: true })
    .eq("session_id", v.sessionId)
    .is("cancelled_at", null);

  if ((count ?? 0) >= klass.capacity) {
    return {
      ok: false,
      message: "That evening is full, sorry. Try another date.",
    };
  }

  const price =
    v.tier === "reduced"
      ? klass.reduced_price_cents
      : v.tier === "subsidized"
        ? klass.subsidized_price_cents
        : klass.full_price_cents;

  /* --- Credits, if they're a member and asked to use them --- */

  let membership: MembershipRow | null = null;

  if (v.useCredits) {
    const user = await getCurrentUser();
    if (!user?.contactId) {
      return {
        ok: false,
        message: "Sign in first to spend credits — we couldn't find your membership.",
      };
    }

    const { data: memberData } = await supabase
      .from("memberships")
      .select("*")
      .eq("contact_id", user.contactId)
      .eq("status", "active")
      .maybeSingle();

    membership = memberData as MembershipRow | null;
    if (!membership) {
      return { ok: false, message: "We couldn't find an active membership for you." };
    }

    const settings = await getCreditSettings();

    const { data: ledgerData } = await supabase
      .from("credit_ledger")
      .select("*")
      .eq("membership_id", membership.id);

    const balance = creditBalance((ledgerData as CreditLedgerRow[] | null) ?? []);

    if (balance.available < klass.credit_cost) {
      return {
        ok: false,
        message: `That class costs ${klass.credit_cost} credit${klass.credit_cost === 1 ? "" : "s"} and you have ${balance.available}. You can still come and pay on the night.`,
      };
    }

    // A shared family pool shouldn't all go on one class.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: sameClassSpend } = await supabase
      .from("credit_ledger")
      .select("delta, session_id, class_sessions!inner(class_id)")
      .eq("membership_id", membership.id)
      .eq("reason", "spent")
      .gte("created_at", monthStart.toISOString());

    const spentOnThisClass = (
      (sameClassSpend as
        | { delta: number; class_sessions: { class_id: string } | null }[]
        | null) ?? []
    )
      .filter((r) => r.class_sessions?.class_id === klass.id)
      .reduce((s, r) => s + -r.delta, 0);

    if (sameClassCapReached(spentOnThisClass, membership.plan, settings)) {
      return {
        ok: false,
        message: `Your household has already put ${settings.family_same_class_cap} credits into this class this month — that cap keeps the pool from going on one thing. You're welcome to come and pay on the night.`,
      };
    }
  }

  const { error } = await supabase.from("enrolments").insert({
    session_id: v.sessionId,
    attendee_name: v.name,
    attendee_email: v.email,
    tier: v.tier,
    method: membership ? "credit" : "cash",
    credits_spent: membership ? klass.credit_cost : 0,
    paid_cents: 0,
    subsidy_cents: membership
      ? klass.full_price_cents
      : Math.max(0, klass.full_price_cents - price),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "You're already on the list for that one." };
    }
    return { ok: false, message: `Couldn't sign you up: ${error.message}` };
  }

  if (membership) {
    await supabase.from("credit_ledger").insert({
      membership_id: membership.id,
      delta: -klass.credit_cost,
      reason: "spent",
      session_id: v.sessionId,
      note: klass.title,
    });
  }

  const when = dateTimeRange(
    sessionData.starts_at as string,
    sessionData.ends_at as string,
  );

  await sendClassSignup({
    to: v.email,
    name: v.name,
    className: klass.title,
    when,
    payingNote: membership
      ? `${klass.credit_cost} credit${klass.credit_cost === 1 ? "" : "s"} taken from your membership.`
      : `Please bring ${(price / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" })} on the night.`,
  });

  await notifyAdmin({
    subject: `Class sign-up — ${klass.title}`,
    heading: "Somebody signed up",
    bodyHtml: `<p style="margin:0 0 14px;"><strong>${v.name}</strong> is coming to ${klass.title}, ${when}.</p>
      <p style="margin:0;">${v.email}${v.phone ? ` · ${v.phone}` : ""}</p>`,
    ctaPath: "/admin/classes",
  });

  revalidatePath("/classes");
  revalidatePath("/admin/classes");
  revalidatePath("/portal");

  return {
    ok: true,
    message: membership
      ? "You're in. We've taken the credits and sent you the details."
      : "You're in. Check your email for the details.",
  };
}
