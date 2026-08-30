import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendWelcomeOnce } from "@/lib/email/welcome";
import { linkContact, nameIsMissing } from "@/lib/profile";

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
/**
 * The address to send people back to.
 *
 * NOT request.nextUrl.origin: behind Netlify's proxy that resolves to the
 * internal deploy host — main--roomwithin.netlify.app — which doesn't serve,
 * so every sign-in ended at a 404. The configured site URL is the only
 * reliable source for the public address.
 */
function siteOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured?.startsWith("http")) return configured.replace(/[/]+$/, "");
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = siteOrigin(request);

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
    if (!error) {
      return NextResponse.redirect(await afterSignIn(supabase, origin, safeNext));
    }
    return fail(error.message.toLowerCase().includes("expired") ? "expired" : "invalid");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(await afterSignIn(supabase, origin, safeNext));
    }
    // The usual cause is a missing verifier: link opened somewhere other than
    // where it was requested, or a mail scanner consumed it first.
    return fail("otherbrowser");
  }

  return fail("nocode");
}

/**
 * Everything that happens once a sign-in succeeds.
 *
 * Links the account to a contact record — without it the portal shows no
 * invoices at all, because that query is skipped when there's no contact to
 * filter on — sends the welcome email if they've never had one, and sends
 * anyone still without a real name to /welcome to give one.
 */
async function afterSignIn(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  origin: string,
  safeNext: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return `${origin}${safeNext}`;

  await linkContact(user.id, user.email ?? null);
  await sendWelcomeOnce(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (nameIsMissing(profile?.full_name as string | null)) {
    return `${origin}/welcome?next=${encodeURIComponent(safeNext)}`;
  }

  return `${origin}${safeNext}`;
}
