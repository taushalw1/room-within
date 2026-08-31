import type { CreditLedgerRow, CreditSettings } from "@/lib/data/types";

/**
 * Community credits.
 *
 * The model is Audible's, because Audible's is the one people already
 * understand: pay monthly, get credits, credits roll over for a while, and
 * unused credits don't punish you too hard.
 *
 * The important accounting point is that a credit sold is not income. It is a
 * class that has been paid for and not yet taught — a promise, and therefore a
 * liability. It becomes income at the moment somebody sits down in the room.
 */

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  individual_price_cents: 4000,
  individual_credits: 4,
  family_price_cents: 7000,
  family_credits: 8,
  extra_credit_cents: 1200,
  dropin_cents: 1300,
  rollover_months: 2,
  family_same_class_cap: 4,
};

/** The first of the month a date falls in, as a date string. */
export function periodOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** When credits granted this month stop being usable. */
export function expiryFor(granted: Date, settings: CreditSettings): string {
  const end = new Date(
    granted.getFullYear(),
    granted.getMonth() + settings.rollover_months + 1,
    0,
  );
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export type CreditBalance = {
  /** Usable right now. */
  available: number;
  /** Granted, unspent, and past its expiry date. */
  expired: number;
  /** Usable, but gone by the end of this month. */
  expiringSoon: number;
  /** Every credit ever granted and not yet spent — the liability. */
  outstanding: number;
};

/**
 * Work the balance out from the ledger rather than storing a number.
 *
 * Grants are consumed oldest-first, so the credits closest to expiring are
 * always the ones spent — which is what a member would do by hand, and what
 * keeps the liability from ageing.
 */
export function creditBalance(
  rows: CreditLedgerRow[],
  today = new Date(),
): CreditBalance {
  const ordered = [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const grants: { remaining: number; expires: Date | null }[] = [];
  let spend = 0;

  for (const row of ordered) {
    if (row.delta > 0) {
      grants.push({
        remaining: row.delta,
        expires: row.expires_on ? new Date(row.expires_on) : null,
      });
    } else {
      spend += -row.delta;
    }
  }

  // Oldest first.
  for (const grant of grants) {
    if (spend <= 0) break;
    const take = Math.min(grant.remaining, spend);
    grant.remaining -= take;
    spend -= take;
  }

  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  let available = 0;
  let expired = 0;
  let expiringSoon = 0;

  for (const grant of grants) {
    if (grant.remaining <= 0) continue;
    if (grant.expires && grant.expires < today) {
      expired += grant.remaining;
      continue;
    }
    available += grant.remaining;
    if (grant.expires && grant.expires <= endOfMonth) {
      expiringSoon += grant.remaining;
    }
  }

  return {
    available,
    expired,
    expiringSoon,
    outstanding: available + expired,
  };
}

/**
 * Whether a household has already spent too much of a shared pool on one class.
 *
 * A shared family pool is simpler than per-person allotments, but it lets one
 * enthusiastic child empty it. The cap is the smallest rule that prevents that
 * without anybody having to police it.
 */
export function sameClassCapReached(
  spentOnThisClassThisMonth: number,
  plan: "individual" | "family",
  settings: CreditSettings,
): boolean {
  if (plan !== "family") return false;
  return spentOnThisClassThisMonth >= settings.family_same_class_cap;
}

/** What a credit is worth, so a drop-in price can be sanity-checked against it. */
export function creditValueCents(
  plan: "individual" | "family",
  settings: CreditSettings,
): number {
  return plan === "family"
    ? Math.round(settings.family_price_cents / Math.max(1, settings.family_credits))
    : Math.round(
        settings.individual_price_cents / Math.max(1, settings.individual_credits),
      );
}

/**
 * A plain-language check that the pricing still hangs together.
 *
 * Shown on the settings page. If a drop-in ticket is cheaper than a credit,
 * nobody subscribes; if extra credits are cheaper than the plan, the plan is
 * pointless. Easy to get wrong while editing numbers, and invisible until
 * somebody notices the money is off, so the app says so out loud.
 */
export function creditWarnings(settings: CreditSettings): string[] {
  const warnings: string[] = [];
  const individual = creditValueCents("individual", settings);
  const family = creditValueCents("family", settings);

  if (settings.dropin_cents <= individual) {
    warnings.push(
      "A drop-in ticket costs the same or less than a credit, so there is no reason to subscribe.",
    );
  }
  if (settings.extra_credit_cents <= individual) {
    warnings.push(
      "Extra credits are cheaper than the monthly plan, so members are better off never subscribing.",
    );
  }
  if (family >= individual) {
    warnings.push(
      "The family plan costs more per credit than the individual plan, so two individual plans would be better value.",
    );
  }
  if (settings.rollover_months > 6) {
    warnings.push(
      "Credits roll over for more than six months, which lets a large unpaid-for backlog build up.",
    );
  }

  return warnings;
}
