import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEFAULT_RESEARCH_SETTINGS } from "@/lib/research";
import {
  sampleOpportunities,
  sampleResearchRuns,
  sampleSteps,
} from "./sample-opportunities";
import type {
  OpportunityKind,
  OpportunityRow,
  OpportunityStepRow,
  ResearchRunRow,
  ResearchSettings,
} from "./types";

/** Reads for the grants and conferences pages. Admin only, throughout. */

export async function getResearchSettings(): Promise<ResearchSettings> {
  if (isDemoMode) return DEFAULT_RESEARCH_SETTINGS;
  const supabase = await getServerSupabase();
  if (!supabase) return DEFAULT_RESEARCH_SETTINGS;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "research")
    .maybeSingle();

  return data?.value
    ? { ...DEFAULT_RESEARCH_SETTINGS, ...(data.value as ResearchSettings) }
    : DEFAULT_RESEARCH_SETTINGS;
}

export async function getOpportunities(
  kind: OpportunityKind,
): Promise<OpportunityRow[]> {
  if (isDemoMode) return sampleOpportunities.filter((o) => o.kind === kind);

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq("kind", kind)
    .order("found_at", { ascending: false });

  return (data as OpportunityRow[]) ?? [];
}

export async function getOpportunity(
  id: string,
): Promise<OpportunityRow | null> {
  if (isDemoMode) return sampleOpportunities.find((o) => o.id === id) ?? null;

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as OpportunityRow) ?? null;
}

export async function getSteps(
  opportunityId: string,
): Promise<OpportunityStepRow[]> {
  if (isDemoMode) {
    return sampleSteps
      .filter((s) => s.opportunity_id === opportunityId)
      .sort((a, b) => a.position - b.position);
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("opportunity_steps")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("position");

  return (data as OpportunityStepRow[]) ?? [];
}

/** How far along every opportunity is, in one query rather than N. */
export async function getStepCounts(
  kind: OpportunityKind,
): Promise<Map<string, { done: number; total: number }>> {
  const out = new Map<string, { done: number; total: number }>();

  const rows = isDemoMode
    ? sampleSteps
    : await (async () => {
        const supabase = await getServerSupabase();
        if (!supabase) return [];
        const { data } = await supabase
          .from("opportunity_steps")
          .select("opportunity_id, done_at");
        return (data as OpportunityStepRow[]) ?? [];
      })();

  const ids = new Set((await getOpportunities(kind)).map((o) => o.id));

  for (const row of rows) {
    if (!ids.has(row.opportunity_id)) continue;
    const cur = out.get(row.opportunity_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (row.done_at) cur.done += 1;
    out.set(row.opportunity_id, cur);
  }

  return out;
}

export async function getResearchRuns(): Promise<ResearchRunRow[]> {
  if (isDemoMode) return sampleResearchRuns;

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("research_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  return (data as ResearchRunRow[]) ?? [];
}

/**
 * Grants that might pay for a trip.
 *
 * Shown on a conference so the question "could something else cover this?" is
 * answered on the page where it comes up, rather than being a separate hunt.
 */
export async function getTravelGrants(): Promise<OpportunityRow[]> {
  const grants = await getOpportunities("grant");
  const today = new Date().toISOString().slice(0, 10);

  return grants.filter(
    (g) =>
      g.covers_travel &&
      !g.archived_at &&
      g.status !== "not_interested" &&
      g.status !== "rejected" &&
      (!g.deadline || g.deadline >= today),
  );
}
