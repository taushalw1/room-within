import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { sampleMaintenance } from "./sample-maintenance";
import type {
  LeaseRow,
  MaintenanceRequestRow,
  UnitRow,
} from "./types";

/** Reads for maintenance reports, on both sides of the building. */

export async function getMaintenance(): Promise<MaintenanceRequestRow[]> {
  if (isDemoMode) return sampleMaintenance;
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  // Row-level security narrows this to her own reports for a renter, and to
  // everything for an admin. One query, two answers.
  const { data } = await supabase
    .from("maintenance_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (data as MaintenanceRequestRow[]) ?? [];
}

export async function getMaintenanceRequest(
  id: string,
): Promise<MaintenanceRequestRow | null> {
  if (isDemoMode) return sampleMaintenance.find((m) => m.id === id) ?? null;
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as MaintenanceRequestRow) ?? null;
}

/**
 * Who lives where, right now.
 *
 * The occupant of a unit is whoever holds its active lease — there is no
 * separate "occupant" field to fall out of step with the tenancy.
 */
export type Occupancy = {
  unit: UnitRow;
  lease: LeaseRow | null;
  occupant: { id: string; name: string; email: string | null; phone: string | null } | null;
};

export async function getOccupancy(): Promise<Occupancy[]> {
  const { getUnits } = await import("./admin");
  const units = await getUnits();

  if (isDemoMode) {
    const { sampleLeases, sampleContacts } = await import("./sample-admin");
    return units.map((unit) => {
      const lease = sampleLeases.find(
        (l) => l.unit_id === unit.id && l.status === "active",
      );
      const contact = lease
        ? sampleContacts.find((c) => c.id === lease.contact_id)
        : undefined;
      return {
        unit,
        lease: lease ?? null,
        occupant: contact
          ? {
              id: contact.id,
              name: contact.full_name,
              email: contact.email,
              phone: contact.phone,
            }
          : null,
      };
    });
  }

  const supabase = await getServerSupabase();
  if (!supabase) return units.map((unit) => ({ unit, lease: null, occupant: null }));

  const { data } = await supabase
    .from("leases")
    .select("*, contacts:contact_id (id, full_name, email, phone)")
    .eq("status", "active");

  const leases =
    (data as (LeaseRow & {
      contacts: { id: string; full_name: string; email: string | null; phone: string | null } | null;
    })[]) ?? [];

  return units.map((unit) => {
    const lease = leases.find((l) => l.unit_id === unit.id);
    return {
      unit,
      lease: lease ?? null,
      occupant: lease?.contacts
        ? {
            id: lease.contacts.id,
            name: lease.contacts.full_name,
            email: lease.contacts.email,
            phone: lease.contacts.phone,
          }
        : null,
    };
  });
}

/** The lease the signed-in renter holds, if any. */
export async function getMyLease(
  contactId: string | null,
): Promise<{ lease: LeaseRow; unit: UnitRow | null } | null> {
  if (!contactId) return null;

  const { getUnits } = await import("./admin");

  if (isDemoMode) {
    const { sampleLeases } = await import("./sample-admin");
    const lease = sampleLeases.find(
      (l) => l.contact_id === contactId && l.status === "active",
    );
    if (!lease) return null;
    const units = await getUnits();
    return { lease, unit: units.find((u) => u.id === lease.unit_id) ?? null };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("leases")
    .select("*")
    .eq("contact_id", contactId)
    .eq("status", "active")
    .maybeSingle();

  const lease = data as LeaseRow | null;
  if (!lease) return null;

  const units = await getUnits();
  return { lease, unit: units.find((u) => u.id === lease.unit_id) ?? null };
}
