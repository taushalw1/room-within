import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Where the emailed sign-in link lands.
 *
 * Supabase can deliver the credential in two shapes depending on how the email
 * template is written, and this handles both:
 *
 *   ?code=...                     PKCE. Needs the code-verifier cookie written
 *                                 by the browser when the link was requested,
 *                                 so it fails if the link is opened in a
 *                                 different browser or on another device.
 *
 *   ?token_hash=...&type=...      Server-side verification. No cookie needed,
 *                                 so the link works wherever it's opened. This
 *                                 is the one to prefer.
 *
 * On failure it sends a specific reason to /login rather than a bare bounce —
 * an unexplained return to the sign-in form reads as "nothing happened".
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/portal";

  // Only ever redirect within this site — an absolute URL would be an open
  // redirect.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/portal";

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/login?error=${reason}`);

  // Supabase reports its own problems (expired link, already used) this way.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError && !code && !tokenHash) return fail("expired");

  const supabase = await getServerSupabase();
  if (!supabase) return fail("unconfigured");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    return fail(error.message.toLowerCase().includes("expired") ? "expired" : "invalid");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    // The usual cause is a missing verifier: link opened somewhere other than
    // where it was requested, or a mail scanner consumed it first.
    return fail("otherbrowser");
  }

  return fail("nocode");
}
