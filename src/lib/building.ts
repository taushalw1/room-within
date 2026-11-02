import { differenceInCalendarDays } from "date-fns";
import type { MaintenanceRequestRow } from "@/lib/data/types";

/**
 * Working out, with no database in it.
 *
 * This is a separate file from `data/building.ts` for one reason: the client
 * components need these, and `data/building.ts` reaches for the signed-in
 * user, which reaches for `next/headers`. Importing one function from that
 * module into a component drags the whole server-only chain into the browser
 * bundle and the build fails with a message that doesn't mention any of this.
 */

/**
 * How overdue a recurring job is, in words.
 *
 * Overdue is shown in days rather than as a red dot, because "three weeks
 * late" and "a day late" want different reactions and a dot gives both the
 * same one.
 */
export function dueState(
  nextDue: string,
  now = new Date(),
): { days: number; label: string; tone: "good" | "warn" | "bad" } {
  const days = differenceInCalendarDays(new Date(`${nextDue}T00:00:00`), now);

  if (days < 0) {
    const late = -days;
    return {
      days,
      label: late === 1 ? "a day late" : `${late} days late`,
      tone: "bad",
    };
  }
  if (days === 0) return { days, label: "due today", tone: "warn" };
  if (days <= 30) {
    return { days, label: days === 1 ? "due tomorrow" : `due in ${days} days`, tone: "warn" };
  }
  return { days, label: `due in ${Math.round(days / 30)} months`, tone: "good" };
}

/** What the repairs on one unit have cost, and how often they recur. */
export function repairSummary(history: MaintenanceRequestRow[]): {
  total: number;
  spentCents: number;
  openCount: number;
  /** Titles that have come up more than once — the real signal. */
  repeats: { title: string; times: number }[];
} {
  const counts = new Map<string, number>();

  for (const r of history) {
    // Compared loosely, because nobody writes the same words twice: "radiator
    // won't heat" and "Radiator in the office won't heat" are one problem.
    const key = r.title.toLowerCase().replace(/[^a-z ]/g, "").trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    total: history.length,
    spentCents: history.reduce((t, r) => t + (r.cost_cents ?? 0), 0),
    openCount: history.filter((r) => !["fixed", "declined"].includes(r.status)).length,
    repeats: [...counts.entries()]
      .filter(([, times]) => times > 1)
      .map(([title, times]) => ({ title, times }))
      .sort((a, b) => b.times - a.times),
  };
}
