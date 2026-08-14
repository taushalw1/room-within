import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Where the emailed sign-in link lands. Exchanges the one-time code for a
 * session cookie, then sends the person on to wherever they were headed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portal";

  // Only ever redirect within this site — an absolute URL here would be an
  // open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/portal";

  if (code) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
