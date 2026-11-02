import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { AuditRow } from "@/lib/audit";

/** The trail, newest first. */
export async function getAuditTrail(
  opts: { table?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  if (isDemoMode) {
    const { sampleAudit } = await import("./sample-audit");
    return opts.table
      ? sampleAudit.filter((r) => r.table_name === opts.table)
      : sampleAudit;
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("at", { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.table) query = query.eq("table_name", opts.table);

  const { data } = await query;
  return (data as AuditRow[]) ?? [];
}

/** Which kinds of thing actually have entries, for the filter row. */
export async function getAuditTables(): Promise<string[]> {
  const rows = await getAuditTrail({ limit: 500 });
  return [...new Set(rows.map((r) => r.table_name))].sort();
}
