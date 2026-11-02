import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { roomYear } from "@/lib/rooms";
import type { LeaseRow, WaitingListRow } from "./types";
import type { RoomYear } from "@/lib/rooms";

/** What each room earned and cost over a period, read from the real books. */
export async function getRoomYears(
  from: string,
  to: string,
): Promise<RoomYear[]> {
  const { getUnits, getAllLeases, getContactNameMap } = await import("./admin");

  const [units, leases, contacts] = await Promise.all([
    getUnits(),
    getAllLeases(),
    getContactNameMap(),
  ]);

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);

  // In demo mode there are no payments to read, so the rent roll stands in for
  // what came in. It makes the page look right without pretending to be real.
  if (isDemoMode) {
    const { sampleMaintenance } = await import("./sample-maintenance");
    return units.map((unit) => {
      const mine = leases.filter((l) => l.unit_id === unit.id);
      const active = mine.find((l) => l.status === "active");
      const spent = sampleMaintenance
        .filter((m) => m.unit_id === unit.id)
        .reduce((t, m) => t + (m.cost_cents ?? 0), 0);
      return roomYear({
        unit,
        leases: mine,
        occupantName: active ? (contacts.get(active.contact_id)?.full_name ?? null) : null,
        receivedCents: active ? active.rent_cents * 12 : 0,
        spentCents: spent,
        from: fromDate,
        to: toDate,
      });
    });
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const [paymentRes, expenseRes, repairRes] = await Promise.all([
    // Money actually received, tied back to a unit through the invoice's lease.
    supabase
      .from("payments")
      .select("amount_cents, paid_at, invoices:invoice_id (lease_id)")
      .gte("paid_at", `${from}T00:00:00`)
      .lte("paid_at", `${to}T23:59:59`),
    supabase
      .from("expenses")
      .select("amount_cents, tax_cents, unit_id, incurred_on")
      .not("unit_id", "is", null)
      .gte("incurred_on", from)
      .lte("incurred_on", to),
    supabase
      .from("maintenance_requests")
      .select("cost_cents, unit_id, fixed_at, expense_id")
      .not("cost_cents", "is", null)
      .gte("fixed_at", `${from}T00:00:00`)
      .lte("fixed_at", `${to}T23:59:59`),
  ]);

  const unitOfLease = new Map(leases.map((l: LeaseRow) => [l.id, l.unit_id]));

  const received = new Map<string, number>();
  for (const p of (paymentRes.data as unknown as {
    amount_cents: number;
    invoices: { lease_id: string | null } | null;
  }[]) ?? []) {
    const leaseId = p.invoices?.lease_id;
    const unitId = leaseId ? unitOfLease.get(leaseId) : undefined;
    if (!unitId) continue;
    received.set(unitId, (received.get(unitId) ?? 0) + p.amount_cents);
  }

  const spent = new Map<string, number>();
  for (const e of (expenseRes.data as {
    amount_cents: number;
    tax_cents: number;
    unit_id: string;
  }[]) ?? []) {
    spent.set(e.unit_id, (spent.get(e.unit_id) ?? 0) + e.amount_cents + e.tax_cents);
  }

  // A repair that was also written up as an expense would otherwise be
  // counted twice.
  for (const r of (repairRes.data as {
    cost_cents: number;
    unit_id: string | null;
    expense_id: string | null;
  }[]) ?? []) {
    if (!r.unit_id || r.expense_id) continue;
    spent.set(r.unit_id, (spent.get(r.unit_id) ?? 0) + r.cost_cents);
  }

  return units.map((unit) => {
    const mine = leases.filter((l) => l.unit_id === unit.id);
    const active = mine.find((l) => l.status === "active");
    return roomYear({
      unit,
      leases: mine,
      occupantName: active ? (contacts.get(active.contact_id)?.full_name ?? null) : null,
      receivedCents: received.get(unit.id) ?? 0,
      spentCents: spent.get(unit.id) ?? 0,
      from: fromDate,
      to: toDate,
    });
  });
}

/* --- The waiting list ------------------------------------------------------ */

export async function getWaitingList(): Promise<WaitingListRow[]> {
  if (isDemoMode) {
    const { sampleWaitingList } = await import("./sample-rooms");
    return sampleWaitingList;
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("waiting_list")
    .select("*")
    .in("status", ["waiting", "offered"])
    .order("created_at");

  return (data as WaitingListRow[]) ?? [];
}
