import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/Section";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How Room Within Community handles your information.`,
};

/**
 * PLACEHOLDER. This is a plain-English starting point, not legal advice.
 * Before going live, have it checked against Alberta's Personal Information
 * Protection Act (PIPA) — and, for anything counselling-related, the Health
 * Information Act and Tausha's own regulatory college requirements.
 */
export default function PrivacyPage() {
  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl">Privacy</h1>

          <div className="mt-8 space-y-6 leading-relaxed text-ink-soft">
            <p>
              This page explains what {site.name} collects and why. It&rsquo;s
              written plainly on purpose.
            </p>

            <div>
              <h2 className="text-xl">What we collect</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Booking a room:</strong> your name, email, phone if
                  you give it, and the details of the booking.
                </li>
                <li>
                  <strong>Renting a space:</strong> the above, plus your lease
                  and payment records.
                </li>
                <li>
                  <strong>Asking about counselling:</strong> your name, contact
                  details and whatever you choose to write. Only Tausha can read
                  it.
                </li>
                <li>
                  <strong>Paying by card:</strong> handled entirely by Stripe.
                  Card numbers never reach this website.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl">Counselling records</h2>
              <p className="mt-3">
                Counselling notes are health information and are treated
                separately from everything else. They are restricted to
                Tausha&rsquo;s account at the database level, and every time a
                note is opened that access is recorded in a log which cannot be
                edited or deleted.
              </p>
            </div>

            <div>
              <h2 className="text-xl">Who else sees it</h2>
              <p className="mt-3">
                Nobody is sold or given your information. It&rsquo;s held using
                Supabase (database and sign-in), Stripe (payments), Resend
                (email) and Netlify (hosting), each of which processes it only to
                make this website work.
              </p>
            </div>

            <div>
              <h2 className="text-xl">Asking us about your information</h2>
              <p className="mt-3">
                Email{" "}
                <a
                  href={`mailto:${site.email}`}
                  className="text-burgundy underline-offset-4 hover:underline"
                >
                  {site.email}
                </a>{" "}
                to see what we hold about you, correct it, or ask us to delete
                it.
              </p>
            </div>

            <p className="rounded-[var(--radius-card)] border border-tan/30 bg-parchment px-5 py-4 text-sm">
              <strong>Note for Tyler and Tausha:</strong> this is a plain-English
              starting point, not legal advice. Have it reviewed against
              Alberta&rsquo;s PIPA, and — for the counselling side — the Health
              Information Act and Tausha&rsquo;s regulatory college, before the
              site goes live. Then delete this box.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
