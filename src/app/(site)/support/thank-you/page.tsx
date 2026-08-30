import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Section";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default function DonationThankYouPage() {
  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-olive/25 bg-sage-pale/40 p-10 text-center">
          <Heart className="mx-auto h-12 w-12 text-burgundy" strokeWidth={1.5} aria-hidden />

          <h1 className="mt-5 text-3xl">Thank you</h1>

          <p className="mt-4 leading-relaxed text-ink-soft">
            Your donation has gone through, and a receipt is on its way to your
            inbox. It goes straight into purchasing and restoring the building —
            nothing else.
          </p>

          <p className="script mt-6 text-2xl">
            One conversation. One relationship. One shared project at a time.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/calendar" size="lg">
              See what&rsquo;s on
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="lg">
              Back to the website
            </ButtonLink>
          </div>

          <p className="mt-8 text-sm text-ink-faint">
            Questions about your donation? Email{" "}
            <a href={`mailto:${site.email}`} className="text-burgundy underline-offset-4 hover:underline">
              {site.email}
            </a>
          </p>
        </div>
      </Container>
    </Section>
  );
}
