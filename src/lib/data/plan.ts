import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { samplePlanGates, samplePlanTasks } from "./sample-plan";
import type { ProjectGateRow, ProjectTaskRow } from "./types";

/** The project plan. Admin only. */

export async function getGates(): Promise<ProjectGateRow[]> {
  if (isDemoMode) return samplePlanGates;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("project_gates")
    .select("*")
    .order("position");
  return (data as ProjectGateRow[]) ?? [];
}

export async function getProjectTasks(): Promise<ProjectTaskRow[]> {
  if (isDemoMode) return samplePlanTasks;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("project_tasks")
    .select("*")
    .order("phase")
    .order("ref");
  return (data as ProjectTaskRow[]) ?? [];
}
