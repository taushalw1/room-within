import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { Role } from "@/lib/data/types";

/** Stand-in identity used only in demo mode. See src/lib/demo.ts. */
const DEMO_ADMIN: CurrentUser = {
  id: "demo-admin",
  email: "demo@roomwithin.local",
  fullName: "Tausha (demo)",
  role: "admin",
  // Pointed at one of the sample tenants, so demo mode can show the renter's
  // side of the app — the tenancy, the clean-out list, the deposit — and not
  // just the admin side. Nothing outside demo mode reads this.
  contactId: "c2",
};

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  contactId: string | null;
};

/** The signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode) return DEMO_ADMIN;

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, contact_id")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? user.email ?? null,
    role: (profile?.role as Role) ?? "member",
    contactId: profile?.contact_id ?? null,
  };
}

/**
 * Gate for every /admin page and admin server action.
 *
 * This is the real security boundary — the middleware only redirects for a
 * nicer experience. Row-level security in Postgres is the second layer: even
 * if this check were somehow bypassed, an ordinary user's queries return no
 * rows for admin-only tables.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/?denied=1");
  return user;
}

/** Gate for the tenant portal and "my bookings". */
export async function requireUser(next = "/portal"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * Gate for the accountant's area.
 *
 * Deliberately not used anywhere under `/admin`. The rule that everything
 * there needs `requireAdmin` is worth more than the small duplication of a
 * second area: a gate that sometimes lets a second role through is a gate
 * somebody will forget to tighten on the one page that mattered.
 *
 * An accountant gets read-only pages here and read-only policies in the
 * database. Neither alone would be enough — the policies are what stop a
 * crafted request, and the missing pages are what stop an honest mistake.
 */
export async function requireBooks(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/books");
  if (user.role !== "admin" && user.role !== "accountant") redirect("/?denied=1");
  return user;
}
