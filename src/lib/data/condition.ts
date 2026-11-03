import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import {
  sampleConditionItems,
  sampleConditionReports,
} from "./sample-condition";
import type { ConditionItemRow, ConditionReportRow } from "./types";

/**
 * Reads for the inspection reports.
 *
 * Both sides use these, as with the move-out: row-level security is what
 * decides whether "every report" means the building's or only your own, so
 * there is one query rather than an admin copy and a tenant copy that could
 * drift apart.
 */

export async function getConditionReports(): Promise<ConditionReportRow[]> {
  if (isDemoMode) return sampleConditionReports;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("condition_reports")
    .select("*")
    .order("created_at", { ascending: false });

  return (data as ConditionReportRow[]) ?? [];
}

export async function getConditionReport(
  id: string,
): Promise<{ report: ConditionReportRow; items: ConditionItemRow[] } | null> {
  if (isDemoMode) {
    const report = sampleConditionReports.find((r) => r.id === id);
    if (!report) return null;
    return {
      report,
      items: sampleConditionItems.filter((i) => i.report_id === id),
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const [{ data: report }, { data: items }] = await Promise.all([
    supabase.from("condition_reports").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("condition_items")
      .select("*")
      .eq("report_id", id)
      .order("position", { ascending: true }),
  ]);

  if (!report) return null;

  return {
    report: report as ConditionReportRow,
    items: (items as ConditionItemRow[]) ?? [],
  };
}

/**
 * Both reports for one tenancy, with their items.
 *
 * The pair is the useful unit. A move-out report read on its own says the
 * carpet is stained; read beside the move-in report it says whether that
 * happened during the tenancy, which is the only question anybody is
 * actually asking.
 */
export async function getConditionPair(leaseId: string): Promise<{
  moveIn: { report: ConditionReportRow; items: ConditionItemRow[] } | null;
  moveOut: { report: ConditionReportRow; items: ConditionItemRow[] } | null;
}> {
  const reports = isDemoMode
    ? sampleConditionReports.filter((r) => r.lease_id === leaseId)
    : await (async () => {
        const supabase = await getServerSupabase();
        if (!supabase) return [];
        const { data } = await supabase
          .from("condition_reports")
          .select("*")
          .eq("lease_id", leaseId);
        return (data as ConditionReportRow[]) ?? [];
      })();

  const load = async (kind: "move_in" | "move_out") => {
    const report = reports.find((r) => r.kind === kind);
    if (!report) return null;
    const found = await getConditionReport(report.id);
    return found;
  };

  const [moveIn, moveOut] = await Promise.all([load("move_in"), load("move_out")]);
  return { moveIn, moveOut };
}

/**
 * The report currently waiting on this tenant, if there is one.
 *
 * Only one at a time: a tenancy has at most one move-in and one move-out
 * report, and they do not overlap in practice.
 */
export async function getMyConditionReport(
  contactId: string | null,
): Promise<{ report: ConditionReportRow; items: ConditionItemRow[] } | null> {
  if (!contactId) return null;

  const all = await getConditionReports();
  const mine = all.find(
    (r) => r.contact_id === contactId && r.status === "awaiting_tenant",
  );

  return mine ? getConditionReport(mine.id) : null;
}
