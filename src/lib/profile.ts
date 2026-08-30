import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * A name is "missing" if it's absent or is just the email address.
 *
 * The database trigger falls back to the email when no name is supplied, and
 * passwordless sign-in never supplies one — so every account starts with an
 * address where a name should be. Greeting someone as
 * "Hello tyler.torrie+4@gmail.com" is worse than not greeting them at all.
 */
export function nameIsMissing(name: string | null | undefined) {
  if (!name) return true;
  return name.includes("@");
}

/**
 * Make sure the signed-in account points at a contact record.
 *
 * Everything financial hangs off `contacts` — invoices, payments, leases — and
 * `profiles.contact_id` is the join. Without it the portal silently shows no
 * invoices, because the query is skipped entirely when there's no contact to
 * filter on. A tenant with rent owing would sign in and see an empty page.
 *
 * Matches on email first, so someone Tausha has already added as a tenant is
 * joined to their existing record rather than duplicated.
 *
 * Runs with the service key: a brand-new user has no rights to read the
 * contacts table, which is the point of the row-level security.
 */
export async function linkContact(userId: string, email: string | null) {
  if (!email) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("contact_id, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.contact_id) return profile.contact_id as string;

    // Already on file? Then this is a tenant or past booker signing in.
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    let contactId = existing?.id as string | undefined;

    if (!contactId) {
      const { data: created } = await supabase
        .from("contacts")
        .insert({
          // Deliberately the email for now — /welcome replaces it with a real
          // name, and a placeholder is better than a blank row in her list.
          full_name: profile?.full_name ?? email,
          email,
          tags: ["member"],
        })
        .select("id")
        .single();
      contactId = created?.id as string | undefined;
    }

    if (!contactId) return null;

    await supabase
      .from("profiles")
      .update({ contact_id: contactId })
      .eq("id", userId);

    return contactId;
  } catch {
    // Never block a sign-in over this.
    return null;
  }
}
