import { getServiceSupabase } from "@/lib/supabase/server";
import { DEFAULT_RESEARCH_SETTINGS, research } from "@/lib/research";
import type { OpportunityKind, ResearchSettings } from "@/lib/data/types";

/**
 * The Monday morning search.
 *
 * Runs once a week rather than daily, because each run costs real money and
 * grant programs do not change hourly.
 *
 * Only ever *adds*. A status, a note, a half-finished checklist or a deadline
 * somebody has already checked is never touched — re-running this must be
 * safe, and quietly rewriting a verified date underneath her would be the
 * worst thing it could do.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set — refusing to run.");
      return new Response("Not configured", { status: 503 });
    }
  } else if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return Response.json({ ok: false, reason: "no database" });

  const { data: row } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "research")
    .maybeSingle();

  const settings: ResearchSettings = {
    ...DEFAULT_RESEARCH_SETTINGS,
    ...((row?.value as ResearchSettings) ?? {}),
  };

  const summary: Record<string, unknown> = {};

  for (const kind of ["grant", "conference"] as OpportunityKind[]) {
    summary[kind] = await runOne(supabase, kind, settings);
  }

  console.log("Weekly research:", JSON.stringify(summary));
  return Response.json({ ok: true, ...summary });
}

type Supabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

async function runOne(
  supabase: Supabase,
  kind: OpportunityKind,
  settings: ResearchSettings,
) {
  const { data: run } = await supabase
    .from("research_runs")
    .insert({ kind })
    .select("id")
    .single();

  const runId = run?.id as string | undefined;
  const finish = async (patch: Record<string, unknown>) => {
    if (!runId) return;
    await supabase
      .from("research_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", runId);
  };

  const outcome = await research(kind, settings);

  if (!outcome.ok) {
    await finish({
      status: settings.enabled ? "failed" : "skipped",
      message: outcome.reason,
    });
    return { ok: false, reason: outcome.reason };
  }

  // Add only what isn't already there.
  const { data: existing } = await supabase
    .from("opportunities")
    .select("fingerprint")
    .eq("kind", kind);

  const seen = new Set(
    ((existing as { fingerprint: string }[] | null) ?? []).map((r) => r.fingerprint),
  );

  const rows = outcome.found
    .filter((f) => !seen.has(f.fingerprint))
    .map((f) => ({
      kind: f.kind,
      title: f.title,
      organisation: f.organisation,
      url: f.url,
      summary: f.summary,
      why_relevant: f.why_relevant,
      eligibility: f.eligibility ?? null,
      amount_min_cents: f.amount_min_cents ?? null,
      amount_max_cents: f.amount_max_cents ?? null,
      deadline: f.deadline ?? null,
      covers_travel: f.covers_travel ?? false,
      starts_on: f.starts_on ?? null,
      ends_on: f.ends_on ?? null,
      location: f.location ?? null,
      is_online: f.is_online ?? false,
      cost_cents: f.cost_cents ?? null,
      cost_note: f.cost_note ?? null,
      confidence: f.confidence,
      source: "search" as const,
      fingerprint: f.fingerprint,
    }));

  let added = 0;
  if (rows.length > 0) {
    const { error } = await supabase
      .from("opportunities")
      .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
    if (error) {
      await finish({ status: "failed", found: outcome.found.length, message: error.message });
      return { ok: false, reason: error.message };
    }
    added = rows.length;
  }

  await finish({ status: "ok", found: outcome.found.length, added });
  return { ok: true, found: outcome.found.length, added };
}
