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
  contactId: null,
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
