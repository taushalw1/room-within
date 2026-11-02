import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import {
  sampleDepositEntries,
  sampleMoveOutItems,
  sampleMoveOuts,
} from "./sample-move-out";
import type {
  DepositEntryRow,
  MoveOutItemRow,
  MoveOutRow,
  SignatureEventRow,
} from "./types";

/**
 * Reads for a tenancy that is ending.
 *
 * Both sides use these. Row-level security is what decides whether "every
 * move-out" means the building's or only your own, so there is one query here
 * rather than an admin copy and a tenant copy that could drift apart.
 */

export async function getMoveOuts(): Promise<MoveOutRow[]> {
  if (isDemoMode) return sampleMoveOuts;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("move_outs")
    .select("*")
    .order("leaving_on", { ascending: true });

  return (data as MoveOutRow[]) ?? [];
}

export async function getMoveOut(
  id: string,
): Promise<{ moveOut: MoveOutRow; items: MoveOutItemRow[] } | null> {
  if (isDemoMode) {
    const moveOut = sampleMoveOuts.find((m) => m.id === id);
    if (!moveOut) return null;
    return {
      moveOut,
      items: sampleMoveOutItems.filter((i) => i.move_out_id === id),
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("move_outs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const moveOut = data as MoveOutRow | null;
  if (!moveOut) return null;

  const { data: items } = await supabase
    .from("move_out_items")
    .select("*")
    .eq("move_out_id", id)
    .order("position", { ascending: true });

  return { moveOut, items: (items as MoveOutItemRow[]) ?? [] };
}

/** The move-out the signed-in renter is in the middle of, if there is one. */
export async function getMyMoveOut(
  contactId: string | null,
): Promise<{ moveOut: MoveOutRow; items: MoveOutItemRow[] } | null> {
  if (!contactId) return null;

  const all = await getMoveOuts();
  const mine = all.find(
    (m) => m.contact_id === contactId && m.status !== "settled",
  );

  return mine ? getMoveOut(mine.id) : null;
}

/* --- The deposit ---------------------------------------------------------- */

export async function getDepositEntries(
  leaseId: string,
): Promise<DepositEntryRow[]> {
  if (isDemoMode) {
    return sampleDepositEntries.filter((d) => d.lease_id === leaseId);
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("deposit_entries")
    .select("*")
    .eq("lease_id", leaseId)
    .order("occurred_on", { ascending: true });

  return (data as DepositEntryRow[]) ?? [];
}

/**
 * What is left of the deposit.
 *
 * Added up from the movements every time rather than kept as a figure
 * somewhere, so there is nothing that can quietly stop agreeing with its own
 * history.
 */
export function depositBalance(entries: DepositEntryRow[]): number {
  return entries.reduce((total, entry) => total + entry.amount_cents, 0);
}

/** How far through the clean-out they are. */
export function checklistProgress(items: MoveOutItemRow[]): {
  done: number;
  total: number;
  outstanding: MoveOutItemRow[];
} {
  const outstanding = items.filter((i) => !i.done_by_tenant);
  return {
    done: items.length - outstanding.length,
    total: items.length,
    outstanding,
  };
}

/** The sealed record of a signing, by id. */
export async function getSignatureEvent(
  id: string | null,
): Promise<SignatureEventRow | null> {
  if (!id) return null;
  if (isDemoMode) return null;

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("signature_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as SignatureEventRow) ?? null;
}
