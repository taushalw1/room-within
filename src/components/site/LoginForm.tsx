"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Why a sign-in link failed, in words that suggest what to do next. An
 * unexplained bounce back to this form reads as "nothing happened", which is
 * the worst possible outcome — people just try again and hit the same wall.
 */
const LINK_ERRORS: Record<string, string> = {
  expired:
    "That link has expired or was already used. Links last one hour and work once — request a fresh one below.",
  otherbrowser:
    "That link was opened somewhere other than where it was requested. Open it in the same browser you asked from, or request a new one here.",
  invalid: "That link didn't work. Request a new one below.",
  nocode: "That link was incomplete. Request a new one below.",
  unconfigured: "Signing in isn't switched on yet — Tyler needs to finish the setup.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/portal";
  const linkError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setState("error");
      setMessage("Signing in isn't switched on yet.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="text-center">
        <Mail className="mx-auto h-10 w-10 text-olive" strokeWidth={1.5} aria-hidden />
        <h2 className="mt-4 font-display text-xl font-semibold text-olive-deep">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          We&rsquo;ve sent a sign-in link to <strong>{email}</strong>. It works
          once, and expires after an hour.
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Open it on this device and you&rsquo;ll stay signed in here —
          you won&rsquo;t have to do this again.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {linkError && state === "idle" && (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-burgundy/25 bg-blush/40 px-4 py-3 text-sm text-ink-soft"
        >
          {LINK_ERRORS[linkError] ?? LINK_ERRORS.invalid}
        </p>
      )}
      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">Email address</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 text-[0.95rem]"
        />
      </label>

      {state === "error" && (
        <p role="alert" className="text-sm text-burgundy">
          {message}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        )}
        Email me a sign-in link
      </Button>
    </form>
  );
}
