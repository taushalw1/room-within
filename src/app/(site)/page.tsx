import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Heart as HeartIcon } from "lucide-react";
import { about } from "@/content/about";
import { Botanical, LeafDivider } from "@/components/brand/Botanical";
import { EventCard } from "@/components/site/EventCard";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Heart, Section, SectionHeading } from "@/components/ui/Section";
import { developmentPlan, offerings } from "@/content/offerings";
import { getUpcomingEvents, getRooms } from "@/lib/data/public";
import { money } from "@/lib/format";

export default async function HomePage() {
  const [events, rooms] = await Promise.all([
    getUpcomingEvents(4),
    getRooms(),
  ]);

  return (
    <>
      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden bg-parchment">
        <Botanical className="absolute -left-16 -top-10 hidden h-[420px] w-[300px] opacity-70 lg:block" />
        <Botanical
          flip
          className="absolute -right-16 top-24 hidden h-[420px] w-[300px] opacity-60 lg:block"
        />

        <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow text-bark">A historic 1905 building</p>
            <h1 className="mt-4 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
              A place to gather, learn,
              <br className="hidden sm:block" /> create, work &amp;{" "}
              <span className="script text-5xl sm:text-6xl lg:text-7xl">
                belong
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Room Within is a historic building on Chamberlain Avenue in Grassy Lake,
              reimagined for families, learning, entrepreneurship and community.
              Book a room, join what&rsquo;s happening, or find a quiet place to
              talk.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/book" size="lg">
                Book a room <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/calendar" variant="secondary" size="lg">
                See what&rsquo;s on
              </ButtonLink>
            </div>

            <p className="mt-8 flex items-center gap-2 text-sm text-ink-faint">
              <Heart className="h-3 w-3" />
              Grassy Lake, Alberta
            </p>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-tan/30 shadow-[var(--shadow-lift)]">
              <Image
                src="/building.jpg"
                alt="The Room Within building on Chamberlain Avenue — a two-storey shingled building with shopfronts for the cafe, offices and daycare, window boxes, and an exterior stair to the upper suites"
                width={1256}
                height={984}
                priority
                sizes="(max-width: 1024px) 92vw, 560px"
                className="h-auto w-full"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ================= Mission banner ================= */}
      <div className="bg-cream py-10">
        <Container>
          <div className="brush-banner px-8 py-7 text-center sm:px-14 sm:py-9">
            <p className="eyebrow mx-auto max-w-3xl !text-[0.8rem] !leading-[1.9] sm:!text-[0.9rem]">
              <span aria-hidden className="mr-3 text-blush">
                ♥
              </span>
              No parent should have to choose between being present for their
              children and contributing their gifts to their community.
              <span aria-hidden className="ml-3 text-blush">
                ♥
              </span>
            </p>
          </div>
        </Container>
      </div>

      {/* ================= What's inside ================= */}
      <Section tint="cream" className="pt-6">
        <Container>
          <div className="text-center">
            <LeafDivider className="mx-auto text-sage" />
            <h2 className="script mt-3 text-4xl sm:text-5xl">
              What you&rsquo;ll find inside
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
              Six ways the building serves Grassy Lake — some open now, others
              growing over the next three years.
            </p>
          </div>

          <ul className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {offerings.map(({ slug, title, blurb, icon: Icon, href, status }) => (
              <li key={slug} className="flex flex-col items-center text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sage-pale/70">
                  <Icon
                    className="h-9 w-9 text-olive"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
                <h3 className="eyebrow mt-5 !text-[0.82rem] text-burgundy">
                  {title}
                </h3>
                <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-soft">
                  {blurb}
                </p>
                {href ? (
                  <Link
                    href={href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-olive underline-offset-4 transition-colors hover:text-burgundy hover:underline"
                  >
                    Learn more
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : (
                  status && (
                    <span className="eyebrow mt-4 rounded-full border border-tan/40 px-3 py-1 text-[0.58rem] text-bark">
                      Planned · {status}
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ================= What's on ================= */}
      <Section tint="sage">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              align="left"
              eyebrow="Community Calendar"
              title="What's happening"
              lead="Events at Room Within and right across Grassy Lake."
            />
            <div className="flex gap-3">
              <ButtonLink href="/calendar" variant="secondary" size="sm">
                Full calendar
              </ButtonLink>
              <ButtonLink href="/calendar/subscribe" variant="ghost" size="sm">
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Add to Google
              </ButtonLink>
            </div>
          </div>

          {events.length > 0 ? (
            <ul className="mt-10 grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-10 rounded-[var(--radius-card)] border border-dashed border-tan/50 bg-cream/60 p-10 text-center text-ink-soft">
              Nothing on the calendar just yet — check back soon.
            </p>
          )}
        </Container>
      </Section>

      {/* ================= Rooms ================= */}
      <Section tint="cream">
        <Container>
          <SectionHeading
            eyebrow="Our Spaces"
            title="Room for what you're"
            script="planning"
            lead="Hourly, half-day and full-day rates. Community groups and non-profits, ask about reduced rates — we'd rather the room was used."
          />

          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rooms.slice(0, 4).map((room) => (
              <li
                key={room.id}
                className="flex flex-col rounded-[var(--radius-card)] border border-tan/25 bg-parchment/60 p-6"
              >
                <h3 className="text-xl">{room.name}</h3>
                {room.capacity && (
                  <p className="eyebrow mt-1.5 text-[0.6rem] text-bark">
                    Seats up to {room.capacity}
                  </p>
                )}
                <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-ink-soft">
                  {room.description}
                </p>
                <p className="mt-5 font-display text-lg text-olive-deep">
                  {money(room.hourly_rate_cents)}
                  <span className="text-sm text-ink-faint"> / hour</span>
                </p>
                <ButtonLink
                  href={`/book?room=${room.slug}`}
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Check availability
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ================= Counselling ================= */}
      <Section tint="parchment">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-tan/30 bg-sage-pale/50">
                {about.photo ? (
                  <Image
                    src={about.photo}
                    alt={about.photoAlt}
                    fill
                    sizes="(max-width: 1024px) 90vw, 460px"
                    className="object-cover"
                    style={{ objectPosition: about.photoPosition }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Botanical className="h-64 w-48 opacity-60" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <SectionHeading
                align="left"
                eyebrow="Counselling"
                title="A quiet room, and someone to"
                script="listen"
                lead="Tausha offers confidential counselling in a private, comfortable room at Room Within. Sessions are booked directly with her, and nothing about them appears on the community calendar."
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/counselling/request" size="lg">
                  Request an appointment
                </ButtonLink>
                <ButtonLink href="/about" variant="secondary" size="lg">
                  Meet Tausha
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ================= Three year plan ================= */}
      <Section tint="cream">
        <Container>
          <div className="text-center">
            <LeafDivider className="mx-auto text-sage" />
            <h2 className="eyebrow mt-4 !text-base sm:!text-lg">
              A Three-Year Development Plan
            </h2>
          </div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {developmentPlan.map(({ year, items }, i) => (
              <li key={year} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive font-display text-xl font-semibold text-cream">
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

      {/* ================= Support ================= */}
      <Section tint="olive">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                align="left"
                onDark
                eyebrow="How you can help"
                title="Help preserve a piece of"
                script="Grassy Lake history"
                lead="We're raising funds to purchase and restore this historic building and create a place that will serve our community for generations."
              />

              <ul className="mt-8 grid gap-x-8 gap-y-3 text-sm text-cream/85 sm:grid-cols-2">
                {[
                  "Donating",
                  "Becoming a future tenant",
                  "Volunteering",
                  "Offering skills or expertise",
                  "Sharing the vision",
                  "Providing letters of support",
                ].map((way) => (
                  <li key={way} className="flex items-center gap-2.5">
                    <HeartIcon
                      className="h-3.5 w-3.5 shrink-0 text-blush"
                      aria-hidden
                    />
                    {way}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink
                  href="/support"
                  size="lg"
                  className="bg-cream text-olive-deep hover:bg-blush"
                >
                  Support the project
                </ButtonLink>
              </div>
            </div>

            <div className="rounded-[var(--radius-card)] border border-cream/25 bg-olive-deep/40 p-8 text-center">
              <h3 className="eyebrow text-cream/75">Funding need</h3>

              <dl className="mt-6 space-y-6">
                <div>
                  <dt className="text-sm text-cream/70">Building purchase</dt>
                  <dd className="font-display text-4xl font-semibold text-cream">
                    $300,000
                  </dd>
                </div>
                <hr className="border-cream/20" />
                <div>
                  <dt className="text-sm text-cream/70">
                    Initial repairs &amp; restoration
                  </dt>
                  <dd className="font-display text-4xl font-semibold text-cream">
                    $100,000
                  </dd>
                </div>
              </dl>

              <p className="eyebrow mt-8 rounded-[var(--radius-card)] bg-cream/10 py-3 text-cream/80">
                Three-Year Community Development Project
              </p>
            </div>
          </div>

          <p className="script mx-auto mt-16 max-w-lg text-center text-3xl text-blush">
            One conversation. One relationship. One shared project at a time.
          </p>
        </Container>
      </Section>
    </>
  );
}
