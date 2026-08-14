import type { Metadata } from "next";
import { Clock, Lock, MapPin, Phone } from "lucide-react";
import { Botanical } from "@/components/brand/Botanical";
import { LogoLockup } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { about } from "@/content/about";
import { money } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Counselling",
  description: `Confidential counselling with ${about.name} at Room Within Community, ${site.town}.`,
};

export default function CounsellingPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-parchment">
        <Botanical className="absolute -right-14 -top-6 hidden h-[360px] w-[260px] opacity-55 lg:block" />
        <Container className="relative py-16 lg:py-24">
          {/* The tagline lockup belongs here more than anywhere: "a place to
              heal" is exactly what this page is about. */}
          <LogoLockup withTagline className="mb-10 h-24" />
          <SectionHeading
            align="left"
            eyebrow="Counselling"
            title="A quiet room, and someone to"
            script="listen"
            lead="Sessions with Tausha in a private, comfortable room at Room Within. You don't need a diagnosis, a referral, or a crisis — sometimes an hour and an unhurried conversation is the whole of it."
          />
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/counselling/request" size="lg">
              Request an appointment
            </ButtonLink>
            <ButtonLink href="/about" variant="secondary" size="lg">
              Meet Tausha
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Section tint="cream">
        <Container>
          <div className="grid gap-10 lg:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "How sessions work",
                body: `Sessions run about an hour. The first one is longer — it's mostly listening, and there's no obligation to carry on. Fees are ${money(14000)} per hour; if cost is what's standing in the way, say so when you get in touch.`,
              },
              {
                icon: Lock,
                title: "What stays private",
                body: "What you say in the room stays there. Nothing about your appointments appears on the community calendar or anywhere else on this website, and your name isn't shared with anyone else using the building.",
              },
              {
                icon: MapPin,
                title: "Where to come",
                body: `The Quiet Room at Room Within, ${site.address.oneLine}. It's a small, softly furnished room away from the busier parts of the building, with its own entrance.`,
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-pale/70">
                  <Icon className="h-5 w-5 text-olive" strokeWidth={1.6} aria-hidden />
                </span>
                <h2 className="mt-4 text-xl">{title}</h2>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <h2 className="eyebrow text-bark">Areas Tausha works with</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {about.specialties.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-olive/25 bg-sage-pale/50 px-3.5 py-1.5 text-[0.85rem] text-olive-deep"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* Crisis information — deliberately prominent, not buried in a footer. */}
      <Section tint="parchment" className="py-14">
        <Container>
          <div className="mx-auto flex max-w-3xl gap-4 rounded-[var(--radius-card)] border border-burgundy/25 bg-blush/40 p-6">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-burgundy" aria-hidden />
            <div className="text-sm leading-relaxed text-ink-soft">
              <h2 className="font-display text-lg font-semibold text-burgundy">
                If you need someone right now
              </h2>
              <p className="mt-2">
                This website isn&rsquo;t monitored around the clock. If
                things are urgent, please call the{" "}
                <strong>Alberta Mental Health Help Line</strong> on{" "}
                <a href="tel:18773032642" className="text-burgundy underline">
                  1-877-303-2642
                </a>{" "}
                — free, confidential, 24 hours. You can also call or text{" "}
                <strong>988</strong> for the Suicide Crisis Helpline. In an
                emergency, call <strong>911</strong>.
              </p>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
