"use client";

import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/Button";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type State =
  | { status: "unknown" }
  | { status: "signedOut" }
  | { status: "signedIn"; name: string; isAdmin: boolean };

/**
 * The signed-in / signed-out corner of the header.
 *
 * Read on the client rather than in the layout on purpose: the layout is a
 * server component shared by every public page, and reading the session there
 * would make all of them dynamic, losing the static rendering the public site
 * relies on. The cost is that the state arrives just after paint, so it starts
 * as "unknown" and renders a spacer rather than flashing "Sign in" at someone
 * who is already signed in.
 */
export function AccountNav({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ status: "unknown" });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return setState({ status: "signedOut" });

    let cancelled = false;

    const read = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      if (!user) return setState({ status: "signedOut" });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setState({
        status: "signedIn",
        name: (profile?.full_name as string) ?? user.email ?? "your account",
        isAdmin: profile?.role === "admin",
      });
    };

    read();

    // Keeps the header honest if they sign out in another tab.
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase?.auth.signOut();
    // Full reload, so server-rendered pages re-render without the session.
    window.location.href = "/";
  }

  if (state.status === "unknown") {
    // Reserve the space so the header doesn't jump when this resolves.
    return <span aria-hidden className={cn("block h-9 w-20", className)} />;
  }

  if (state.status === "signedOut") {
    return (
      <ButtonLink href="/login" variant="secondary" size="sm" className={className}>
        Sign in
      </ButtonLink>
    );
  }

  const firstName = state.name.split(" ")[0].split("@")[0];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {state.isAdmin && (
        <ButtonLink href="/admin" variant="ghost" size="sm">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Admin
        </ButtonLink>
      )}

      <ButtonLink href="/portal" variant="secondary" size="sm">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[9rem] truncate">{firstName}</span>
      </ButtonLink>

      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only">Sign out</span>
      </Button>
    </span>
  );
}
