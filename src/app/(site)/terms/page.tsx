import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/Section";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Booking terms",
  description: "Terms for booking a room at Room Within Community.",
};

/** PLACEHOLDER — adjust the cancellation window and deposit rules to match
 *  what Tausha actually wants, then have it read over before going live. */
export default function TermsPage() {
  return (
    <Section tint="cream">
      <Container>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl">Booking terms</h1>

          <div className="mt-8 space-y-6 leading-relaxed text-ink-soft">
            <div>
              <h2 className="text-xl">Confirming a booking</h2>
              <p className="mt-3">
                Some rooms are confirmed by Tausha before payment; others can be
                booked and paid for straight away. Either way, a booking is only
                held once you have a confirmation email.
              </p>
            </div>

            <div>
              <h2 className="text-xl">Changes and cancellations</h2>
              <p className="mt-3">
                Let us know at least 48 hours ahead and we&rsquo;ll refund in
                full or move your booking. Inside 48 hours we&rsquo;ll do what we
                can — just get in touch.
              </p>
            </div>

            <div>
              <h2 className="text-xl">Looking after the building</h2>
              <p className="mt-3">
                Please leave the room roughly as you found it, and let us know
                about any damage. This is a 1905 building — we&rsquo;d rather
                hear about a problem than discover it.
              </p>
            </div>

            <div>
              <h2 className="text-xl">Questions</h2>
              <p className="mt-3">
                Email{" "}
                <a
                  href={`mailto:${site.email}`}
                  className="text-burgundy underline-offset-4 hover:underline"
                >
                  {site.email}
                </a>
                .
              </p>
            </div>

            <p className="rounded-[var(--radius-card)] border border-tan/30 bg-parchment px-5 py-4 text-sm">
              <strong>Note for Tyler and Tausha:</strong> placeholder wording.
              Set the cancellation window and any deposit rules to match what you
              actually want, then delete this box.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
