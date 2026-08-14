import type { Metadata } from "next";
import { Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { offerings } from "@/content/offerings";
import { getRooms } from "@/lib/data/public";
import { money } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Our Spaces",
  description: `Rooms, offices and suites at Room Within Community in ${site.town} — rates, capacity and what each space suits.`,
};

export default async function SpacesPage() {
  const rooms = await getRooms();

  return (
    <>
      <Section tint="parchment" className="py-16">
        <Container>
          <SectionHeading
            eyebrow="Our Spaces"
            title="Room for what you're"
            script="planning"
            lead="A historic building with several kinds of space under one roof. Hourly and daily bookings, monthly offices, and suites for people staying a while."
          />
        </Container>
      </Section>

      {/* Bookable rooms */}
      <Section tint="cream" id="rooms">
        <Container>
          <h2 className="eyebrow text-bark">Rooms you can book</h2>

          <ul className="mt-8 space-y-6">
            {rooms.map((room) => (
              <li
                key={room.id}
                id={room.slug}
                className="grid gap-6 rounded-[var(--radius-card)] border border-tan/25 bg-parchment/40 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr]"
              >
                <div>
                  <h3 className="text-2xl">{room.name}</h3>
                  {room.capacity && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ink-soft">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      Seats up to {room.capacity}
                    </p>
                  )}
                  <p className="mt-3 leading-relaxed text-ink-soft">
                    {room.description}
                  </p>
                </div>

                <div className="rounded-[var(--radius-card)] bg-cream p-5">
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-soft">Hourly</dt>
                      <dd className="font-semibold tabular-nums">
                        {money(room.hourly_rate_cents)}
                      </dd>
                    </div>
                    {room.half_day_rate_cents && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink-soft">Half day</dt>
                        <dd className="font-semibold tabular-nums">
                          {money(room.half_day_rate_cents)}
                        </dd>
                      </div>
                    )}
                    {room.full_day_rate_cents && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink-soft">Full day</dt>
                        <dd className="font-semibold tabular-nums">
                          {money(room.full_day_rate_cents)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <p className="mt-3 text-xs text-ink-faint">
                    Plus GST. Minimum booking {room.min_hours}h.
                  </p>

                  <ButtonLink
                    href={`/book?room=${room.slug}`}
                    size="sm"
                    className="mt-4 w-full"
                  >
                    Check availability
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-ink-soft">
            Community groups and non-profits — reduced rates are available.{" "}
            <a
              href={`mailto:${site.email}`}
              className="text-burgundy underline-offset-4 hover:underline"
            >
              Ask before you book
            </a>
            . We&rsquo;d rather the room was used.
          </p>
        </Container>
      </Section>

      {/* Longer-term space */}
      <Section tint="sage" id="offices">
        <Container>
          <SectionHeading
            eyebrow="Longer term"
            title="Offices &amp; residential"
            script="suites"
            lead="For practitioners, small businesses, remote workers and visiting professionals who need somewhere for months rather than hours."
          />

          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {offerings
              .filter((o) => ["offices", "suites", "maker-space"].includes(o.slug))
              .map(({ slug, title, blurb, icon: Icon }) => (
                <li
                  key={slug}
                  id={slug}
                  className="rounded-[var(--radius-card)] border border-tan/25 bg-cream p-6"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-pale/70">
                    <Icon
                      className="h-5 w-5 text-olive"
                      strokeWidth={1.6}
                      aria-hidden
                    />
                  </span>
                  <h3 className="mt-4 text-xl">{title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                    {blurb}
                  </p>
                </li>
              ))}
          </ul>

          <div className="mt-10">
            <ButtonLink href={`mailto:${site.email}`} size="lg">
              Enquire about a space
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
