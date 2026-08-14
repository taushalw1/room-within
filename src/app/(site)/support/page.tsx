import type { Metadata } from "next";
import {
  Handshake,
  Heart as HeartIcon,
  KeyRound,
  Mail,
  Megaphone,
  PenLine,
  Wrench,
} from "lucide-react";
import { Botanical } from "@/components/brand/Botanical";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { developmentPlan } from "@/content/offerings";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support the Project",
  description:
    "Help preserve a piece of Grassy Lake history — donate, volunteer, become a tenant, or lend your skills to Room Within Community.",
};

const ways = [
  {
    icon: HeartIcon,
    title: "Donating",
    body: "Every contribution, big or small, makes a lasting impact — and goes straight into the purchase and the repairs.",
  },
  {
    icon: KeyRound,
    title: "Becoming a future tenant",
    body: "An office, a suite, or a regular slot in the gathering room. Letters of intent help enormously with funding applications.",
  },
  {
    icon: Handshake,
    title: "Volunteering",
    body: "Painting, cleaning, moving furniture, putting the kettle on, minding children while other people work — all of it counts.",
  },
  {
    icon: Wrench,
    title: "Offering skills or expertise",
    body: "Trades, accounting, grant writing, legal advice, heritage building knowledge. If you know how to do something, we'd love to hear it.",
  },
  {
    icon: Megaphone,
    title: "Sharing the vision",
    body: "Tell a neighbour. Share it in your group. Word of mouth in a town this size is worth more than any advert.",
  },
  {
    icon: PenLine,
    title: "Providing letters of support",
    body: "A short letter saying why this matters to you carries real weight with funders and with the county.",
  },
];

export default function SupportPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-parchment">
        <Botanical className="absolute -left-14 -top-8 hidden h-[380px] w-[280px] opacity-60 lg:block" />
        <Botanical
          flip
          className="absolute -right-14 top-16 hidden h-[380px] w-[280px] opacity-50 lg:block"
        />

        <Container className="relative py-16 text-center lg:py-24">
          <p className="eyebrow text-bark">How you can help</p>
          <h1 className="mt-4 text-4xl sm:text-5xl">
            Help preserve a piece of
            <br />
            <span className="script text-5xl sm:text-6xl">
              Grassy Lake history
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            We&rsquo;re raising funds to purchase and restore this historic 1905
            building, and create a place that will serve our community for
            generations.
          </p>

          <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-tan/30 bg-cream p-7">
              <p className="eyebrow text-bark">Building purchase</p>
              <p className="mt-2 font-display text-4xl font-semibold text-olive-deep">
                $300,000
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-tan/30 bg-cream p-7">
              <p className="eyebrow text-bark">Repairs &amp; restoration</p>
              <p className="mt-2 font-display text-4xl font-semibold text-olive-deep">
                $100,000
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`mailto:${site.email}?subject=${encodeURIComponent("I'd like to help")}`} size="lg">
              <Mail className="h-4 w-4" aria-hidden />
              Get in touch
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Section tint="cream">
        <Container>
          <SectionHeading
            eyebrow="Six ways to help"
            title="Every contribution, big or small, makes a"
            script="lasting impact"
          />

          <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {ways.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-pale/70">
                  <Icon className="h-5 w-5 text-olive" strokeWidth={1.6} aria-hidden />
                </span>
                <h3 className="mt-4 text-xl">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tint="olive">
        <Container>
          <SectionHeading
            onDark
            eyebrow="Where it's going"
            title="A three-year community development project"
          />

          <ol className="mt-14 grid gap-8 sm:grid-cols-3">
            {developmentPlan.map(({ year, items }, i) => (
              <li key={year}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream font-display text-lg font-semibold text-olive-deep">
                  {i + 1}
                </span>
                <h3 className="eyebrow mt-4 !text-[0.78rem] text-blush">
                  {year}
                </h3>
                <ul className="mt-3 space-y-2 text-[0.95rem] leading-relaxed text-cream/80">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <p className="script mx-auto mt-16 max-w-lg text-center text-3xl text-blush">
            By reaching out to our community, we hope to build community.
          </p>
        </Container>
      </Section>
    </>
  );
}
