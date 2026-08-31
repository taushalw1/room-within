import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEFAULT_CLASS_SETTINGS } from "@/lib/classes";
import { DEFAULT_CREDIT_SETTINGS } from "@/lib/credits";
import {
  sampleClassSessions,
  sampleClasses,
  sampleCreditLedger,
  sampleEnrolments,
  sampleEquipment,
  sampleInstructors,
  sampleMemberships,
  sampleStorageRentals,
} from "./sample-classes";
import type {
  ClassRow,
  ClassSessionRow,
  ClassSettings,
  CreditLedgerRow,
  CreditSettings,
  EnrolmentRow,
  EquipmentRow,
  InstructorRow,
  MembershipRow,
  PublicClass,
  StorageRentalRow,
} from "./types";

/**
 * Reads for the classes, instructors and membership side of the app.
 *
 * The public helpers read from the `public_classes` and `public_instructors`
 * views rather than the tables. The tables carry the instructor's private
 * materials cost and their pay arrangements; the views simply do not contain
 * those columns, so no amount of asking the API can return them.
 */



/* ------------------------------- Settings -------------------------------- */

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  if (isDemoMode) return fallback;
  const supabase = await getServerSupabase();
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  return data?.value ? { ...fallback, ...(data.value as T) } : fallback;
}

export function getClassSettings(): Promise<ClassSettings> {
  return readSetting("classes", DEFAULT_CLASS_SETTINGS);
}

export function getCreditSettings(): Promise<CreditSettings> {
  return readSetting("credits", DEFAULT_CREDIT_SETTINGS);
}

/* ------------------------------ Instructors ------------------------------- */

export async function getInstructors(): Promise<InstructorRow[]> {
  if (isDemoMode) return sampleInstructors;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("instructors")
    .select("*")
    .order("display_name");
  return (data as InstructorRow[]) ?? [];
}

export async function getEquipment(): Promise<EquipmentRow[]> {
  if (isDemoMode) return sampleEquipment;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("equipment").select("*").order("name");
  return (data as EquipmentRow[]) ?? [];
}

export async function getStorageRentals(): Promise<StorageRentalRow[]> {
  if (isDemoMode) return sampleStorageRentals;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("storage_rentals")
    .select("*")
    .order("started_on", { ascending: false });
  return (data as StorageRentalRow[]) ?? [];
}

/* -------------------------------- Classes --------------------------------- */

/** Admin view — includes the private materials cost. */
export async function getClasses(): Promise<ClassRow[]> {
  if (isDemoMode) return sampleClasses;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("classes").select("*").order("title");
  return (data as ClassRow[]) ?? [];
}

/** Public view — materials cost and private notes are not selected. */
export async function getPublicClasses(): Promise<PublicClass[]> {
  if (isDemoMode) {
    return sampleClasses
      .filter((c) => c.is_public && (c.status === "open" || c.status === "full"))
      .map(({ materials_cost_cents: _c, materials_note: _n, ...rest }) => rest);
  }
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("public_classes")
    .select("*")
    .order("title");
  return (data as unknown as PublicClass[]) ?? [];
}

export async function getClassSessions(): Promise<ClassSessionRow[]> {
  if (isDemoMode) return sampleClassSessions;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("class_sessions")
    .select("*")
    .order("starts_at");
  return (data as ClassSessionRow[]) ?? [];
}

export async function getEnrolments(): Promise<EnrolmentRow[]> {
  if (isDemoMode) return sampleEnrolments;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("enrolments")
    .select("*")
    .order("created_at");
  return (data as EnrolmentRow[]) ?? [];
}

/** Equipment attached to each class, keyed by class id. */
export async function getClassEquipment(): Promise<
  Map<string, { equipment: EquipmentRow; quantity: number }[]>
> {
  const equipment = await getEquipment();
  const byId = new Map(equipment.map((e) => [e.id, e]));
  const out = new Map<string, { equipment: EquipmentRow; quantity: number }[]>();

  if (isDemoMode) {
    // The arts club uses easels; Fix It Night brings its own tools.
    const easel = byId.get("eq-3");
    if (easel) out.set("cls-1", [{ equipment: easel, quantity: 6 }]);
    return out;
  }

  const supabase = await getServerSupabase();
  if (!supabase) return out;

  const { data } = await supabase
    .from("class_equipment")
    .select("class_id, equipment_id, quantity");

  for (const row of (data as
    | { class_id: string; equipment_id: string; quantity: number }[]
    | null) ?? []) {
    const item = byId.get(row.equipment_id);
    if (!item) continue;
    const list = out.get(row.class_id) ?? [];
    list.push({ equipment: item, quantity: row.quantity });
    out.set(row.class_id, list);
  }

  return out;
}

/* ------------------------------ Memberships ------------------------------- */

export async function getMemberships(): Promise<MembershipRow[]> {
  if (isDemoMode) return sampleMemberships;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("memberships")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as MembershipRow[]) ?? [];
}

export async function getCreditLedger(): Promise<CreditLedgerRow[]> {
  if (isDemoMode) return sampleCreditLedger;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("credit_ledger")
    .select("*")
    .order("created_at");
  return (data as CreditLedgerRow[]) ?? [];
}

/** One member's ledger — used by the portal. */
export async function getCreditLedgerFor(
  membershipId: string,
): Promise<CreditLedgerRow[]> {
  const all = await getCreditLedger();
  return all.filter((r) => r.membership_id === membershipId);
}

export async function getMembershipForContact(
  contactId: string | null,
): Promise<MembershipRow | null> {
  if (!contactId) return null;
  const all = await getMemberships();
  return (
    all.find((m) => m.contact_id === contactId && m.status !== "cancelled") ??
    null
  );
}

/** Instructors as the website shows them — no pay arrangements, no notes. */
export async function getPublicInstructors(): Promise<
  Pick<
    InstructorRow,
    "id" | "display_name" | "headline" | "bio" | "photo_url" | "standing"
  >[]
> {
  if (isDemoMode) return sampleInstructors.filter((i) => i.is_active);
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("public_instructors")
    .select("*")
    .order("display_name");
  return (data as InstructorRow[]) ?? [];
}
