import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";

/** Settings that aren't rates — the switches Tausha can turn on and off. */

export type LateFeeSettings = {
  enabled: boolean;
  /** Days past the due date before anything is charged. */
  grace_days: number;
  kind: "fixed" | "percent";
  amount_cents: number;
  percent: number;
  /** A ceiling, so a percentage fee on a large invoice can't run away. */
  max_cents: number;
  /** Which kinds of invoice a fee may be charged against. */
  applies_to: string[];
};

export const DEFAULT_LATE_FEES: LateFeeSettings = {
  enabled: false,
  grace_days: 5,
  kind: "fixed",
  amount_cents: 2500,
  percent: 0,
  max_cents: 5000,
  applies_to: ["rent"],
};

export type DigestSettings = { enabled: boolean };
export const DEFAULT_DIGEST: DigestSettings = { enabled: true };

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  if (isDemoMode) return fallback;

  // Read with whichever key is to hand: the cron routes have no session, the
  // admin pages do.
  const supabase = (await getServerSupabase()) ?? getServiceSupabase();
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  return { ...fallback, ...((data?.value as Partial<T>) ?? {}) };
}

export function getLateFeeSettings(): Promise<LateFeeSettings> {
  return readSetting("late_fees", DEFAULT_LATE_FEES);
}

export function getDigestSettings(): Promise<DigestSettings> {
  return readSetting("digest", DEFAULT_DIGEST);
}

/**
 * What a late fee on this invoice would come to.
 *
 * Separate from anything that charges it, so the admin page can show the
 * figure before Tausha commits to it and the nightly run can use exactly the
 * same arithmetic.
 */
export function lateFeeFor(
  settings: LateFeeSettings,
  invoice: { kind: string; balance_cents: number },
): number {
  if (!settings.enabled) return 0;
  if (!settings.applies_to.includes(invoice.kind)) return 0;
  if (invoice.balance_cents <= 0) return 0;

  const raw =
    settings.kind === "percent"
      ? Math.round((invoice.balance_cents * settings.percent) / 100)
      : settings.amount_cents;

  const capped = settings.max_cents > 0 ? Math.min(raw, settings.max_cents) : raw;

  // Never charge a fee larger than the debt it is attached to.
  return Math.max(0, Math.min(capped, invoice.balance_cents));
}
