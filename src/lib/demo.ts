import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Demo mode: no database connected, and we're running locally.
 *
 * In this state the admin area opens without a login and shows sample figures,
 * so the whole app can be explored before Supabase is set up.
 *
 * The `NODE_ENV` check is what makes this safe. On Vercel `NODE_ENV` is
 * "production", so if the environment variables were ever missing in a real
 * deployment the admin area would stay locked rather than falling open.
 */
export const isDemoMode =
  !isSupabaseConfigured && process.env.NODE_ENV === "development";
