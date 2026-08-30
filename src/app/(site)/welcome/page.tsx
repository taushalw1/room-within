import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoBadge } from "@/components/brand/Logo";
import { NameForm } from "@/components/site/NameForm";
import { Container, Section } from "@/components/ui/Section";
import { requireUser } from "@/lib/auth";
import { nameIsMissing } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

/**
 * Asked once, the first time someone signs in.
 *
 * Passwordless sign-in never collects a name — the account is created from an
 * email address alone — so without this the site greets people by their email
 * and Tausha's people list is a column of addresses.
 *
 * Anyone who already has a name is sent straight on, so this can't become a
 * step people hit twice.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireUser("/welcome");
  const { next } = await searchParams;

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/portal";

  if (!nameIsMissing(user.fullName)) redirect(safeNext);

  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <LogoBadge className="h-24" />
          </div>

          <h1 className="mt-8 text-center text-3xl">
            You&rsquo;re in. What should we call you?
          </h1>
          <p className="mt-3 text-center text-ink-soft">
            Just so we&rsquo;re not writing to you as{" "}
            <span className="break-all">{user.email}</span>.
          </p>

          <div className="mt-8 rounded-[var(--radius-card)] border border-tan/25 bg-parchment/40 p-6 sm:p-8">
            <NameForm next={safeNext} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
