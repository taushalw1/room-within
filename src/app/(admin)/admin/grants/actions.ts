"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { getResearchSettings } from "@/lib/data/opportunities";
import { fingerprint, stepsFor } from "@/lib/opportunities";
import { research, type FoundOpportunity } from "@/lib/research";
import type { OpportunityKind, OpportunityRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No database connection." };

function refresh() {
  revalidatePath("/admin/grants");
  revalidatePath("/admin/conferences");
}

/* ------------------------------ Moving states ------------------------------ */

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "new",
    "interested",
    "not_interested",
    "applied",
    "awarded",
    "rejected",
  ]),
});

/**
 * Change where something sits in the pipeline.
 *
 * Marking a grant interesting is also what builds its checklist — the steps
 * have no purpose until she has decided to pursue it, and creating them
 * earlier would bury every list under tasks for things she never wanted.
 */
export async function setStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, message: "That status isn't one of the options." };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { data: row, error } = await supabase
    .from("opportunities")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id, kind")
    .single();

  if (error) return { ok: false, message: error.message };

  let addedSteps = false;
  if (parsed.data.status === "interested" && row) {
    addedSteps = await ensureSteps(row.id as string, row.kind as OpportunityKind);
  }

  refresh();
  revalidatePath(`/admin/grants/${parsed.data.id}`);
  revalidatePath(`/admin/conferences/${parsed.data.id}`);

  return {
    ok: true,
    message: addedSteps
      ? "Marked interested, and the steps are ready for you."
      : "Saved.",
  };
}

/** Writes the checklist, once. Safe to call again — it won't duplicate. */
async function ensureSteps(id: string, kind: OpportunityKind): Promise<boolean> {
  const supabase = await getServerSupabase();
  if (!supabase) return false;

  const { count } = await supabase
    .from("opportunity_steps")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", id);

  if ((count ?? 0) > 0) return false;

  const rows = stepsFor(kind).map((step, i) => ({
    opportunity_id: id,
    position: i + 1,
    title: step.title,
    detail: step.detail,
  }));

  const { error } = await supabase.from("opportunity_steps").insert(rows);
  return !error;
}

export async function toggleStep(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const stepId = String(formData.get("stepId") ?? "");
  const done = formData.get("done") === "true";

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { data, error } = await supabase
    .from("opportunity_steps")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", stepId)
    .select("opportunity_id")
    .single();

  if (error) return { ok: false, message: error.message };

  if (data) {
    revalidatePath(`/admin/grants/${data.opportunity_id}`);
    revalidatePath(`/admin/conferences/${data.opportunity_id}`);
  }
  refresh();

  return { ok: true, message: done ? "Ticked off." : "Unticked." };
}

export async function setArchived(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  const archive = formData.get("archive") === "true";

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("opportunities")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  refresh();
  revalidatePath(`/admin/grants/${id}`);
  revalidatePath(`/admin/conferences/${id}`);

  return {
    ok: true,
    message: archive
      ? "Put away. You'll find it under Archived."
      : "Brought back.",
  };
}

/**
 * Mark the details as checked against the funder's own page.
 *
 * This is the point of the whole provenance business: until somebody has
 * looked, every figure here came from a machine reading a web page.
 */
export async function setVerified(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("opportunities")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  refresh();
  revalidatePath(`/admin/grants/${id}`);
  revalidatePath(`/admin/conferences/${id}`);
  return { ok: true, message: "Marked as checked." };
}

export async function saveNotes(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("opportunities")
    .update({ notes: notes || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/grants/${id}`);
  revalidatePath(`/admin/conferences/${id}`);
  return { ok: true, message: "Notes saved." };
}

/* ------------------------------ Adding by hand ----------------------------- */

const manualSchema = z.object({
  kind: z.enum(["grant", "conference"]),
  title: z.string().trim().min(3, "What is it called?"),
  organisation: z.string().trim().max(200).optional(),
  url: z.string().trim().url("That link doesn't look right."),
  summary: z.string().trim().max(2000).optional(),
  deadline: z.string().optional(),
  startsOn: z.string().optional(),
  amountMax: z.coerce.number().min(0).optional(),
  cost: z.coerce.number().min(0).optional(),
  coversTravel: z.coerce.boolean().optional(),
});

export async function addOpportunity(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = manualSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    organisation: formData.get("organisation"),
    url: formData.get("url"),
    summary: formData.get("summary"),
    deadline: formData.get("deadline") || undefined,
    startsOn: formData.get("startsOn") || undefined,
    amountMax: formData.get("amountMax") || undefined,
    cost: formData.get("cost") || undefined,
    coversTravel: formData.get("coversTravel") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("opportunities").insert({
    kind: v.kind,
    title: v.title,
    organisation: v.organisation || null,
    url: v.url,
    summary: v.summary || null,
    deadline: v.deadline || null,
    starts_on: v.startsOn || null,
    amount_max_cents: v.amountMax != null ? Math.round(v.amountMax * 100) : null,
    cost_cents: v.cost != null ? Math.round(v.cost * 100) : null,
    covers_travel: Boolean(v.coversTravel),
    source: "manual",
    // Added by hand from a page she was looking at, so it starts out trusted.
    verified_at: new Date().toISOString(),
    fingerprint: fingerprint(v.kind, v.title, v.url),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That one is already on the list." };
    }
    return { ok: false, message: error.message };
  }

  refresh();
  return { ok: true, message: "Added." };
}

/* ------------------------------- The search -------------------------------- */

/**
 * Store what a search turned up.
 *
 * New things are inserted; things already on the list are left completely
 * alone. That matters — re-running the search must never overwrite a status,
 * a note, or a half-finished checklist, and it must never quietly change a
 * deadline underneath somebody who has already checked it.
 */
export async function saveFindings(
  kind: OpportunityKind,
  found: FoundOpportunity[],
): Promise<{ added: number }> {
  const supabase = await getServerSupabase();
  if (!supabase || found.length === 0) return { added: 0 };

  const { data: existing } = await supabase
    .from("opportunities")
    .select("fingerprint")
    .eq("kind", kind);

  const seen = new Set(
    ((existing as { fingerprint: string }[] | null) ?? []).map((r) => r.fingerprint),
  );

  const rows = found
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

  if (rows.length === 0) return { added: 0 };

  // Ignore duplicates rather than failing the batch: two results in one run
  // can collapse to the same fingerprint.
  const { error } = await supabase
    .from("opportunities")
    .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });

  return { added: error ? 0 : rows.length };
}

/** Runs a search now. The same routine the Monday job uses. */
export async function searchNow(kind: OpportunityKind): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const settings = await getResearchSettings();

  const { data: run } = await supabase
    .from("research_runs")
    .insert({ kind })
    .select("id")
    .single();

  const runId = run?.id as string | undefined;
  const finish = async (patch: Record<string, unknown>) => {
    if (runId) {
      await supabase
        .from("research_runs")
        .update({ finished_at: new Date().toISOString(), ...patch })
        .eq("id", runId);
    }
  };

  const outcome = await research(kind, settings);

  if (!outcome.ok) {
    await finish({ status: "failed", message: outcome.reason });
    refresh();
    return { ok: false, message: outcome.reason };
  }

  const { added } = await saveFindings(kind, outcome.found);
  await finish({ status: "ok", found: outcome.found.length, added });

  refresh();

  return {
    ok: true,
    message:
      added === 0
        ? `Looked at ${outcome.found.length}, nothing new this time.`
        : `${added} new ${added === 1 ? "one" : "ones"} added, out of ${outcome.found.length} looked at. Check each against its own page before relying on it.`,
  };
}

export async function searchGrantsNow(): Promise<ActionResult> {
  return searchNow("grant");
}

export async function searchConferencesNow(): Promise<ActionResult> {
  return searchNow("conference");
}

/** Used by the detail pages to show the record after an edit. */
export type { OpportunityRow };
