import type { Metadata } from "next";
import Image from "next/image";
import { Botanical, LeafDivider } from "@/components/brand/Botanical";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { about } from "@/content/about";
import { developmentPlan } from "@/content/offerings";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `Meet ${about.name}, ${about.role.toLowerCase()} at Room Within Community in ${site.town}.`,
};

export default function AboutPage() {
  return (
    <>
      {/* ================= Intro ================= */}
      <section className="relative overflow-hidden bg-parchment">
        <Botanical className="absolute -right-12 -top-8 hidden h-[380px] w-[280px] opacity-60 lg:block" />

        <Container className="relative grid items-start gap-12 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:py-24">
          {/* Photo */}
          <div className="mx-auto w-full max-w-sm lg:mx-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-tan/30 bg-sage-pale/50 shadow-[var(--shadow-lift)]">
              {about.photo ? (
                <Image
                  src={about.photo}
                  alt={about.photoAlt}
                  fill
                  sizes="(max-width: 1024px) 90vw, 380px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
                  <Botanical className="h-40 w-32 opacity-70" />
                  <p className="text-xs leading-relaxed text-ink-faint">
                    Tausha&rsquo;s photo goes here
                    <br />
                    <span className="opacity-70">
                      (save it as public/tausha.jpg)
                    </span>
                  </p>
                </div>
              )}
            </div>

            {about.credentials.length > 0 && (
              <div className="mt-6 rounded-[var(--radius-card)] border border-tan/25 bg-cream p-5">
                <h2 className="eyebrow text-bark">Qualifications</h2>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                  {about.credentials.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            <p className="eyebrow text-bark">{about.role}</p>
            <h1 className="mt-3 text-5xl sm:text-6xl">
              <span className="script text-6xl sm:text-7xl">{about.name}</span>
            </h1>
            <p className="mt-4 text-lg text-ink-soft">{about.tagline}</p>

            <LeafDivider className="mt-7 text-sage" />

            <div className="mt-7 space-y-5 text-[1.05rem] leading-relaxed text-ink-soft">
              {about.bio.map((para) => (
                <p key={para.slice(0, 24)}>{para}</p>
              ))}
            </div>

            <h2 className="eyebrow mt-10 text-bark">Areas I work with</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {about.specialties.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-olive/25 bg-sage-pale/50 px-3.5 py-1.5 text-[0.82rem] text-olive-deep"
                >
                  {s}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/counselling/request" size="lg">
                Request an appointment
              </ButtonLink>
              <ButtonLink
                href={`mailto:${site.email}`}
                variant="secondary"
                size="lg"
              >
                Send an email
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* ================= Pull quote ================= */}
      <Section tint="cream" className="py-16">
        <Container>
          <blockquote className="script mx-auto max-w-3xl text-center text-3xl leading-snug sm:text-4xl">
            &ldquo;{about.pullQuote}&rdquo;
          </blockquote>
        </Container>
      </Section>

      {/* ================= The building ================= */}
      <Section tint="sage">
        <Container>
          <SectionHeading
            eyebrow="The Building"
            title="Building community, not"
            script="competing with it"
            lead="This project is intended to complement our local hall and existing community spaces. By offering smaller, more intimate spaces, we hope to expand the opportunities available to families, entrepreneurs, educators, and community groups throughout the year."
          />

          <ol className="mt-14 grid gap-8 sm:grid-cols-3">
            {developmentPlan.map(({ year, items }, i) => (
              <li
                key={year}
                className="rounded-[var(--radius-card)] border border-tan/25 bg-cream p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-olive font-display text-lg font-semibold text-cream">
                  {i + 1}
                </span>
                <h3 className="eyebrow mt-4 !text-[0.78rem] text-burgundy">
                  {year}
                </h3>
                <ul className="mt-3 space-y-2 text-[0.92rem] leading-relaxed text-ink-soft">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
    </>
  );
}
