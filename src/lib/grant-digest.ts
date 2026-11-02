import { amountRange, deadlineNote, urgencyOf } from "@/lib/opportunities";
import { money } from "@/lib/format";
import { sendGrantDigest } from "@/lib/email/send";
import type { OpportunityRow } from "@/lib/data/types";

/**
 * The Monday email.
 *
 * Two things go in it: grants found since the last one went out, and grants
 * already on her list that are about to close. The second half is the one that
 * actually saves an application — a grant found three weeks ago and forgotten
 * is the usual way a deadline goes by.
 *
 * Each grant is stamped once it has been included, so a job that runs twice
 * never sends the same grant twice.
 */

type Supabase = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        is: (col: string, val: unknown) => Promise<{ data: unknown }>;
      };
    };
    update: (patch: Record<string, unknown>) => {
      in: (col: string, vals: string[]) => Promise<{ error: unknown }>;
    };
  };
};

/** Closing within this many days counts as "about to close". */
const CLOSING_WINDOW = 45;

export type DigestOutcome = {
  sent: boolean;
  newCount: number;
  closingCount: number;
  reason?: string;
};

export async function sendWeeklyDigest(
  supabase: Supabase,
  to: string | undefined,
): Promise<DigestOutcome> {
  if (!to) {
    return { sent: false, newCount: 0, closingCount: 0, reason: "No admin email set." };
  }

  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq("kind", "grant")
    .is("archived_at", null);

  const grants = (data as OpportunityRow[] | null) ?? [];

  // Anything found but never yet mentioned in a Monday email.
  const fresh = grants
    .filter((g) => !g.digest_sent_at)
    .filter((g) => g.status !== "not_interested" && g.status !== "rejected")
    .sort((a, b) => {
      // Soonest deadline first; undated last.
      const ad = a.deadline ?? "9999";
      const bd = b.deadline ?? "9999";
      return ad.localeCompare(bd);
    });

  // Already known, still live, and closing inside the window.
  const closing = grants
    .filter((g) => g.digest_sent_at)
    .filter((g) => g.status === "new" || g.status === "interested")
    .filter((g) => {
      const u = urgencyOf(g.deadline);
      return u === "urgent" || u === "soon";
    })
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  if (fresh.length === 0 && closing.length === 0) {
    return { sent: false, newCount: 0, closingCount: 0, reason: "Nothing worth sending." };
  }

  const result = await sendGrantDigest({
    to,
    grants: fresh.map((g) => ({
      title: g.title,
      organisation: g.organisation,
      amount: amountRange(g, money),
      deadline: g.deadline,
      deadlineNote: g.deadline
        ? deadlineNote(g.deadline)
        : (g.deadline_note ?? "No deadline given"),
      urgent: urgencyOf(g.deadline) === "urgent",
      url: g.url,
      why: g.why_relevant,
    })),
    closingSoon: closing.map((g) => ({
      title: g.title,
      deadlineNote: deadlineNote(g.deadline),
    })),
  });

  if (!result.ok) {
    return {
      sent: false,
      newCount: fresh.length,
      closingCount: closing.length,
      reason: result.message,
    };
  }

  // Stamp only after a successful send, so a failure is retried next week
  // rather than silently swallowed.
  if (fresh.length > 0) {
    await supabase
      .from("opportunities")
      .update({ digest_sent_at: new Date().toISOString() })
      .in(
        "id",
        fresh.map((g) => g.id),
      );
  }

  return { sent: true, newCount: fresh.length, closingCount: closing.length };
}

export { CLOSING_WINDOW };
