"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/portal";

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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
