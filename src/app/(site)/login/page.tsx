import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/site/LoginForm";
import { Container, Section } from "@/components/ui/Section";
import { LogoBadge } from "@/components/brand/Logo";
import { isDemoMode } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <LogoBadge className="h-32" />
          </div>

          <h1 className="mt-8 text-center text-3xl">Sign in</h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-ink-soft">
            For tenants, room bookers, and Tausha. We&rsquo;ll email you a link
            to sign in — there&rsquo;s no password to remember.
          </p>

          <div className="mt-8 rounded-[var(--radius-card)] border border-tan/25 bg-parchment/40 p-6 sm:p-8">
            {isDemoMode ? (
              <p className="text-center text-sm text-ink-soft">
                The app is running in demo mode, so signing in isn&rsquo;t
                needed — the admin area is open at{" "}
                <a href="/admin" className="text-burgundy underline">
                  /admin
                </a>
                .
              </p>
            ) : (
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
