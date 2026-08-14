import type { Metadata } from "next";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

export default function BookingThankYouPage() {
  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-olive/25 bg-sage-pale/40 p-10 text-center">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-olive"
            strokeWidth={1.5}
            aria-hidden
          />
          <h1 className="mt-5 text-3xl">You&rsquo;re booked in</h1>
          <p className="mt-4 text-ink-soft">
            Thank you — your payment went through and the room is yours. A
            confirmation is on its way to your inbox with all the details.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/calendar/subscribe" size="lg">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Add our calendar to yours
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="lg">
              Back to the website
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
