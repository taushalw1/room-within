/**
 * Supabase connection details.
 *
 * The whole site is built to work *before* these are filled in: every data
 * helper falls back to sample content when `isSupabaseConfigured` is false.
 * That means `npm run dev` shows a complete-looking site on a fresh clone,
 * and the real data lights up the moment `.env.local` is filled in.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
