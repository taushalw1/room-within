import type {
  ClassRow,
  ClassSessionRow,
  ClassSettings,
  EnrolmentRow,
  EquipmentRow,
  InstructorRow,
  StorageRentalRow,
  Tier,
} from "@/lib/data/types";

/**
 * The money rules for classes.
 *
 * Everything here is deliberately arithmetic on plain objects — no database,
 * no dates fetched from anywhere. The rules are the part that has to be
 * explainable to an instructor standing in the kitchen, so they live in one
 * readable place rather than being spread through the pages that show them.
 */

export const DEFAULT_CLASS_SETTINGS: ClassSettings = {
  hub_split_percent: 30,
  confirm_hours_before: 24,
  earned_after_sessions: 10,
  earned_min_average_attendance: 4,
};

export const TIER_LABELS: Record<Tier, string> = {
  full: "Full price",
  reduced: "Reduced",
  subsidized: "Subsidized",
};

/** What this tier costs for this class. */
export function tierPrice(klass: ClassRow, tier: Tier): number {
  if (tier === "reduced") return klass.reduced_price_cents;
  if (tier === "subsidized") return klass.subsidized_price_cents;
  return klass.full_price_cents;
}

/**
 * What the scholarship fund makes up on a seat.
 *
 * The instructor is paid on the full price whichever tier the attendee chose.
 * That is the whole point of the sliding scale: choosing "subsidized" costs
 * the instructor nothing, so nobody has any reason to discourage it.
 */
export function subsidyFor(klass: ClassRow, tier: Tier): number {
  return Math.max(0, klass.full_price_cents - tierPrice(klass, tier));
}

/** The hub's share, as a percentage. An instructor override wins if set. */
export function hubSplitPercent(
  settings: ClassSettings,
  instructor?: InstructorRow | null,
): number {
  if (instructor?.split_percent != null) {
    return Math.min(100, Math.max(0, 100 - instructor.split_percent));
  }
  return Math.min(100, Math.max(0, settings.hub_split_percent));
}

export type SessionMoney = {
  /** Seats that actually count — cancelled sign-ups don't. */
  headcount: number;
  /** What attendees handed over, across all tiers. */
  collectedCents: number;
  /** What the scholarship fund topped up. */
  subsidyCents: number;
  /** Collected + subsidy: what the split is calculated on. */
  splittableCents: number;
  instructorCents: number;
  hubCents: number;
  equipmentCents: number;
  /** Recorded for the landlord only. Never deducted from anybody. */
  materialsCents: number;
  subsidizedSeats: number;
  overSubsidyCap: boolean;
};

/**
 * The money for one session.
 *
 * Equipment is charged per session that runs, and is the hub's income. It is
 * shown as its own line rather than folded into a facility fee, so an
 * instructor can see exactly what they are being charged for.
 */
export function sessionMoney(
  klass: ClassRow,
  enrolments: EnrolmentRow[],
  opts: {
    settings: ClassSettings;
    instructor?: InstructorRow | null;
    equipment?: { equipment: EquipmentRow; quantity: number }[];
  },
): SessionMoney {
  const live = enrolments.filter((e) => !e.cancelled_at);

  const collectedCents = live.reduce((s, e) => s + e.paid_cents, 0);
  const subsidyCents = live.reduce(
    (s, e) => s + (e.subsidy_cents || subsidyFor(klass, e.tier)),
    0,
  );

  const splittableCents = collectedCents + subsidyCents;
  const hubPercent = hubSplitPercent(opts.settings, opts.instructor);

  const hubCents = Math.round((splittableCents * hubPercent) / 100);
  const instructorCents = splittableCents - hubCents;

  const equipmentCents = (opts.equipment ?? []).reduce(
    (s, e) => s + e.equipment.session_rate_cents * e.quantity,
    0,
  );

  const subsidizedSeats = live.filter((e) => e.tier === "subsidized").length;

  return {
    headcount: live.length,
    collectedCents,
    subsidyCents,
    splittableCents,
    instructorCents,
    hubCents,
    equipmentCents,
    materialsCents: klass.materials_cost_cents * live.length,
    subsidizedSeats,
    overSubsidyCap: subsidizedSeats > klass.subsidized_seat_cap,
  };
}

/**
 * Whether a session should confirm or cancel itself.
 *
 * This is the rule that keeps the whole thing free of judgement calls: a
 * session needs its minimum headcount by the cut-off, or it cancels and the
 * credits go back. No conversation, nothing to dispute, nobody has to decide
 * whether somebody has "earned" anything.
 */
export function sessionDecision(
  klass: ClassRow,
  session: ClassSessionRow,
  headcount: number,
  settings: ClassSettings,
  now: Date,
): "confirm" | "cancel" | "wait" {
  if (session.status !== "scheduled") return "wait";

  const cutoff = new Date(
    new Date(session.starts_at).getTime() -
      settings.confirm_hours_before * 3_600_000,
  );

  if (headcount >= klass.min_headcount) return "confirm";
  return now >= cutoff ? "cancel" : "wait";
}

/**
 * Whether an instructor has reached earned standing.
 *
 * Standing is worked out from the numbers, so it can be shown to somebody who
 * hasn't reached it yet as a checklist rather than as a verdict. What it
 * unlocks is priority and protection — never pay for a class that didn't run.
 */
export function earnedStanding(
  sessionsDelivered: number,
  averageAttendance: number,
  lateCancellations: number,
  settings: ClassSettings,
): { earned: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (sessionsDelivered < settings.earned_after_sessions) {
    reasons.push(
      `${sessionsDelivered} of ${settings.earned_after_sessions} classes taught`,
    );
  }
  if (averageAttendance < settings.earned_min_average_attendance) {
    reasons.push(
      `average attendance ${averageAttendance.toFixed(1)}, needs ${settings.earned_min_average_attendance}`,
    );
  }
  if (lateCancellations > 0) {
    reasons.push(
      `${lateCancellations} late cancellation${lateCancellations === 1 ? "" : "s"}`,
    );
  }

  return { earned: reasons.length === 0, reasons };
}

/** Storage that was being rented at any point during a given month. */
export function storageDueForMonth(
  rentals: StorageRentalRow[],
  period: Date,
): number {
  const monthStart = new Date(period.getFullYear(), period.getMonth(), 1);
  const monthEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0);

  return rentals
    .filter((r) => {
      const started = new Date(r.started_on);
      const ended = r.ended_on ? new Date(r.ended_on) : null;
      return started <= monthEnd && (!ended || ended >= monthStart);
    })
    .reduce((s, r) => s + r.monthly_rate_cents, 0);
}

export type StatementDraft = {
  instructorId: string;
  period: string;
  classRevenueCents: number;
  instructorShareCents: number;
  equipmentCents: number;
  storageCents: number;
  guaranteedCents: number;
  materialsCents: number;
  netPayoutCents: number;
  sessionsDelivered: number;
};

/**
 * One instructor's month.
 *
 * Deductions come off the payout rather than being invoiced, so an instructor
 * is never chasing a bill and Tausha is never chasing a payment. Materials are
 * recorded but not deducted — that money was already theirs.
 */
export function buildStatement(args: {
  instructor: InstructorRow;
  period: Date;
  sessions: {
    session: ClassSessionRow;
    klass: ClassRow;
    money: SessionMoney;
  }[];
  storage: StorageRentalRow[];
}): StatementDraft {
  const delivered = args.sessions.filter(
    (s) => s.session.status === "delivered",
  );

  const classRevenueCents = delivered.reduce(
    (s, d) => s + d.money.splittableCents,
    0,
  );
  const instructorShareCents = delivered.reduce(
    (s, d) => s + d.money.instructorCents,
    0,
  );
  const equipmentCents = delivered.reduce(
    (s, d) => s + d.money.equipmentCents,
    0,
  );
  const materialsCents = delivered.reduce(
    (s, d) => s + d.money.materialsCents,
    0,
  );

  const storageCents = storageDueForMonth(args.storage, args.period);

  // A guarantee tops the share up to a floor; it is not paid on top of it.
  // Sessions that were cancelled before they ran are not owed anything.
  const guaranteedCents = delivered.reduce((s, d) => {
    const floor = args.instructor.guaranteed_pay_cents;
    return s + Math.max(0, floor - d.money.instructorCents);
  }, 0);

  const netPayoutCents = Math.max(
    0,
    instructorShareCents + guaranteedCents - equipmentCents - storageCents,
  );

  return {
    instructorId: args.instructor.id,
    period: `${args.period.getFullYear()}-${String(args.period.getMonth() + 1).padStart(2, "0")}-01`,
    classRevenueCents,
    instructorShareCents,
    equipmentCents,
    storageCents,
    guaranteedCents,
    materialsCents,
    netPayoutCents,
    sessionsDelivered: delivered.length,
  };
}
