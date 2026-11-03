import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { MoveInFacts } from "@/lib/onboarding";
import type { LeaseRow } from "./types";

/**
 * What has actually been done for each current tenancy.
 *
 * One query per kind of record over all tenancies at once, rather than nine
 * queries per tenancy. With a dozen tenancies the difference is a page that
 * loads and a page that doesn't.
 *
 * Every lookup is written to treat a missing table or a failed query as "not
 * done" rather than throwing. The inspections table arrives in a migration
 * that may not have been run yet, and a Rentals page that dies because of a
 * progress indicator would be a poor trade.
 */
export async function getMoveInFacts(
  leases: LeaseRow[],
): Promise<Map<string, MoveInFacts>> {
  const empty: MoveInFacts = {
    hasEmergencyContact: false,
    keysIssued: null,
    depositHeldCents: 0,
    invoiceRaised: false,
    hasEmail: false,
    inspectionStarted: false,
    inspectionSigned: false,
    hasAccount: false,
    hasSignature: false,
    welcomed: false,
  };

  const out = new Map<string, MoveInFacts>();

  // What the lease itself already says, which needs no query at all.
  for (const lease of leases) {
    out.set(lease.id, {
      ...empty,
      hasEmergencyContact: Boolean(
        (lease as LeaseRow & { emergency_name?: string | null }).emergency_name,
      ),
      keysIssued:
        (lease as LeaseRow & { keys_issued?: number | null }).keys_issued ?? null,
    });
  }

  if (isDemoMode || leases.length === 0) return out;

  const supabase = await getServerSupabase();
  if (!supabase) return out;

  const leaseIds = leases.map((l) => l.id);
  const contactIds = [...new Set(leases.map((l) => l.contact_id))];

  const [deposits, invoices, inspections, profiles, sent, contacts] = await Promise.all([
    supabase
      .from("deposit_entries")
      .select("lease_id, amount_cents, kind")
      .in("lease_id", leaseIds)
      .eq("kind", "held"),
    supabase.from("invoices").select("lease_id").in("lease_id", leaseIds),
    supabase
      .from("condition_reports")
      .select("lease_id, kind, status")
      .in("lease_id", leaseIds)
      .eq("kind", "move_in"),
    supabase.from("profiles").select("id, contact_id").in("contact_id", contactIds),
    supabase
      .from("messages_sent")
      .select("contact_id, delivered")
      .in("contact_id", contactIds)
      .eq("delivered", true),
    supabase.from("contacts").select("id, email").in("id", contactIds),
  ]);

  // Signing in is matched to the tenancy by email address, so a contact with
  // no address on file is a tenant who can never reach their own portal.
  const withEmail = new Set(
    ((contacts.data as { id: string; email: string | null }[]) ?? [])
      .filter((c) => c.email && c.email.trim() !== "")
      .map((c) => c.id),
  );

  for (const d of (deposits.data as { lease_id: string; amount_cents: number }[]) ?? []) {
    const facts = out.get(d.lease_id);
    if (facts) facts.depositHeldCents += d.amount_cents;
  }

  for (const i of (invoices.data as { lease_id: string | null }[]) ?? []) {
    if (!i.lease_id) continue;
    const facts = out.get(i.lease_id);
    if (facts) facts.invoiceRaised = true;
  }

  for (const r of (inspections.data as { lease_id: string; status: string }[]) ?? []) {
    const facts = out.get(r.lease_id);
    if (!facts) continue;
    facts.inspectionStarted = true;
    // Signed either way: agreeing and disagreeing both produce a sealed
    // signature, and both are a tenant having had their say.
    if (r.status === "agreed" || r.status === "disputed") {
      facts.inspectionSigned = true;
    }
  }

  const profileRows =
    (profiles.data as { id: string; contact_id: string | null }[]) ?? [];

  const profileByContact = new Map(
    profileRows
      .filter((p) => p.contact_id)
      .map((p) => [p.contact_id as string, p.id]),
  );

  // Signatures are looked up by profile, so this needs the profiles first.
  const signedProfiles = new Set<string>();
  if (profileRows.length > 0) {
    const { data } = await supabase
      .from("signatures")
      .select("profile_id")
      .in(
        "profile_id",
        profileRows.map((p) => p.id),
      );
    for (const s of (data as { profile_id: string }[]) ?? []) {
      signedProfiles.add(s.profile_id);
    }
  }

  const welcomed = new Set(
    ((sent.data as { contact_id: string | null }[]) ?? [])
      .map((m) => m.contact_id)
      .filter((id): id is string => id !== null),
  );

  for (const lease of leases) {
    const facts = out.get(lease.id);
    if (!facts) continue;

    const profileId = profileByContact.get(lease.contact_id);
    facts.hasEmail = withEmail.has(lease.contact_id);
    facts.hasAccount = Boolean(profileId);
    facts.hasSignature = Boolean(profileId && signedProfiles.has(profileId));
    facts.welcomed = welcomed.has(lease.contact_id);
  }

  return out;
}
