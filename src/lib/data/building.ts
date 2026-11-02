import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import {
  sampleContractors,
  sampleRecurringTasks,
  sampleWarranties,
} from "./sample-building";
import type {
  ContractorRow,
  MaintenanceRequestRow,
  RecurringTaskRow,
  WarrantyRow,
} from "./types";

/** Reads for the three things that keep an old building standing. */

export async function getContractors(): Promise<ContractorRow[]> {
  if (isDemoMode) return sampleContractors;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("contractors")
    .select("*")
    .eq("is_active", true)
    .order("trade")
    .order("name");

  return (data as ContractorRow[]) ?? [];
}

export async function getRecurringTasks(): Promise<RecurringTaskRow[]> {
  if (isDemoMode) return sampleRecurringTasks;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("recurring_tasks")
    .select("*")
    .eq("is_active", true)
    .order("next_due_on");

  return (data as RecurringTaskRow[]) ?? [];
}

export async function getWarranties(): Promise<WarrantyRow[]> {
  if (isDemoMode) return sampleWarranties;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("warranties")
    .select("*")
    .order("expires_on", { ascending: true, nullsFirst: false });

  return (data as WarrantyRow[]) ?? [];
}

/**
 * Everything that has ever been reported about one unit.
 *
 * The point of keeping it per room rather than as one long list: the third
 * time the same radiator is reported, the question stops being "who can fix
 * this" and becomes "should we be replacing it" — and that only becomes
 * obvious when the three reports are next to each other.
 */
export async function getRepairHistory(
  unitId: string,
): Promise<MaintenanceRequestRow[]> {
  if (isDemoMode) {
    const { sampleMaintenance } = await import("./sample-maintenance");
    return sampleMaintenance.filter((m) => m.unit_id === unitId);
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });

  return (data as MaintenanceRequestRow[]) ?? [];
}
