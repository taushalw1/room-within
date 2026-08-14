import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Supabase client for server components, route handlers and server actions.
 * Reads the signed-in user from cookies, so row-level security applies.
 *
 * Returns `null` when Supabase isn't configured yet — callers fall back to
 * sample data rather than crashing.
 */
export async function getServerSupabase() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — the middleware refreshes the
          // session instead, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses row-level security, so it must only ever be
 * used in server-side code the public cannot reach directly: Stripe webhooks,
 * scheduled reminder jobs, and admin-only actions that have already checked
 * the caller is an admin.
 */
export function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) return null;

  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
