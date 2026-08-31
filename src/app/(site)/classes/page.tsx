import type { Metadata } from "next";
import { CalendarDays, Coins, Users } from "lucide-react";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { ClassSignUp } from "@/components/site/ClassSignUp";
import { getCurrentUser } from "@/lib/auth";
import {
  getClassSessions,
  getCreditLedgerFor,
  getCreditSettings,
  getEnrolments,
  getPublicInstructors,
  getMembershipForContact,
  getPublicClasses,
} from "@/lib/data/classes";
import { creditBalance } from "@/lib/credits";
import { dateTimeRange, moneyExact } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Classes",
  description: `Classes and clubs at Room Within Community in ${site.town} — taught by neighbours, priced so anyone can come.`,
};

export default async function ClassesPage() {
  const [classes, sessions, enrolments, instructors, settings, user] =
    await Promise.all([
      getPublicClasses(),
      getClassSessions(),
      getEnrolments(),
      getPublicInstructors(),
      getCreditSettings(),
      getCurrentUser(),
    ]);

  const membership = await getMembershipForContact(user?.contactId ?? null);
  const ledger = membership ? await getCreditLedgerFor(membership.id) : [];
  const balance = creditBalance(ledger);

  const instructorById = new Map(instructors.map((i) => [i.id, i]));
  const now = new Date();

  const seatsTaken = new Map<string, number>();
  for (const e of enrolments) {
    if (e.cancelled_at) continue;
    seatsTaken.set(e.session_id, (seatsTaken.get(e.session_id) ?? 0) + 1);
  }

  // Earned instructors first — that is what earned standing buys.
  const ordered = [...classes].sort((a, b) => {
    const aEarned = instructorById.get(a.instructor_id ?? "")?.standing === "earned";
    const bEarned = instructorById.get(b.instructor_id ?? "")?.standing === "earned";
    if (aEarned !== bEarned) return aEarned ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <>
      <Section tint="parchment" className="py-16">
        <Container>
          <SectionHeading
            eyebrow="Classes"
            title="Taught by people who"
            script="live here"
            lead="Somebody in this town knows how to do the thing you'd like to learn. These are their classes. Choose the price that's right for you — nobody is asked why."
          />
        </Container>
      </Section>

      {/* The plans */}
      <Section tint="cream">
        <Container>
          <div className="grid gap-6 rounded-[var(--radius-card)] border border-tan/25 bg-parchment/40 p-6 sm:p-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h2 className="eyebrow text-bark">A community plan</h2>
              <p className="mt-3 text-ink-soft">
                Pay once a month, get credits, spend them on whatever&rsquo;s
                on. Credits keep for {settings.rollover_months} months, so a
                busy few weeks doesn&rsquo;t cost you anything.
              </p>
            </div>

            <PlanCard
              title="Individual"
              price={settings.individual_price_cents}
              credits={settings.individual_credits}
            />
            <PlanCard
              title="Family"
              price={settings.family_price_cents}
              credits={settings.family_credits}
              note="One pool of credits for the whole household."
            />
          </div>

          <p className="mt-4 text-sm text-ink-soft">
            Rather not commit? Come to anything for{" "}
            {moneyExact(settings.dropin_cents)} on the night, or pay the class
            price below. To join a plan,{" "}
            <a href={`mailto:${site.email}`} className="underline">
              send us a note
            </a>
            .
          </p>

          {membership && (
            <p className="mt-4 rounded-[var(--radius-card)] bg-sage-pale/50 px-5 py-3.5 text-sm">
              You have <strong>{balance.available} credits</strong> to spend.
              {balance.expiringSoon > 0 && (
                <span className="text-burgundy">
                  {" "}
                  {balance.expiringSoon} of them go at the end of this month.
                </span>
              )}
            </p>
          )}
        </Container>
      </Section>

      {/* The classes */}
      <Section tint="parchment">
        <Container>
          <h2 className="eyebrow text-bark">What&rsquo;s on</h2>

          {ordered.length === 0 ? (
            <p className="mt-8 rounded-[var(--radius-card)] bg-cream p-8 text-center text-ink-soft">
              Nothing scheduled just now. If you&rsquo;d like to teach
              something,{" "}
              <a href={`mailto:${site.email}`} className="underline">
                we&rsquo;d love to hear from you
              </a>
              .
            </p>
          ) : (
            <ul className="mt-8 space-y-8">
              {ordered.map((klass) => {
                const instructor = instructorById.get(klass.instructor_id ?? "");
                const upcoming = sessions
                  .filter(
                    (s) =>
                      s.class_id === klass.id &&
                      s.status !== "cancelled" &&
                      new Date(s.starts_at) >= now &&
                      (seatsTaken.get(s.id) ?? 0) < klass.capacity,
                  )
                  .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

                return (
                  <li
                    key={klass.id}
                    id={klass.id}
                    className="grid gap-8 rounded-[var(--radius-card)] border border-tan/25 bg-cream p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr]"
                  >
                    <div>
                      <h3 className="text-2xl">{klass.title}</h3>
                      {instructor && (
                        <p className="mt-1 font-script text-xl text-burgundy">
                          with {instructor.display_name}
                        </p>
                      )}

                      {klass.description && (
                        <p className="mt-4 leading-relaxed text-ink-soft">
                          {klass.description}
                        </p>
                      )}

                      <dl className="mt-5 space-y-2 text-sm text-ink-soft">
                        <Fact icon={CalendarDays}>
                          {klass.session_minutes} minutes
                          {upcoming.length > 0 &&
                            ` · next on ${dateTimeRange(upcoming[0].starts_at, upcoming[0].ends_at)}`}
                        </Fact>
                        <Fact icon={Users}>
                          Up to {klass.capacity} people, and it runs once{" "}
                          {klass.min_headcount} have signed up
                        </Fact>
                        <Fact icon={Coins}>
                          {moneyExact(klass.subsidized_price_cents)} to{" "}
                          {moneyExact(klass.full_price_cents)}, or{" "}
                          {klass.credit_cost} credit
                          {klass.credit_cost === 1 ? "" : "s"}
                        </Fact>
                      </dl>

                      {instructor?.bio && (
                        <p className="mt-5 border-t border-tan/25 pt-4 text-sm leading-relaxed text-ink-faint">
                          {instructor.bio}
                        </p>
                      )}
                    </div>

                    <div className="rounded-[var(--radius-card)] bg-parchment/50 p-5 sm:p-6">
                      <ClassSignUp
                        klass={klass}
                        sessions={upcoming}
                        hasCredits={
                          Boolean(membership) &&
                          balance.available >= klass.credit_cost
                        }
                        creditBalance={balance.available}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </Section>

      {/* Teaching */}
      <Section tint="cream">
        <Container className="max-w-3xl text-center">
          <h2 className="text-3xl">Could you teach one?</h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            You don&rsquo;t need a qualification, a business, or a plan. You
            need something you know how to do and a couple of hours. We handle
            the room, the sign-ups and the money, you keep the larger share of
            what comes in, and you set your own materials cost.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Nobody teaches for nothing here. You&rsquo;re paid from the first
            class you run.
          </p>
          <p className="mt-6">
            <a href={`mailto:${site.email}`} className="underline">
              {site.email}
            </a>
          </p>
        </Container>
      </Section>
    </>
  );
}

function PlanCard({
  title,
  price,
  credits,
  note,
}: {
  title: string;
  price: number;
  credits: number;
  note?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-cream p-5">
      <p className="eyebrow !text-[0.6rem] text-bark">{title}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-olive-deep">
        {moneyExact(price)}
        <span className="ml-1.5 text-base font-normal text-ink-soft">
          a month
        </span>
      </p>
      <p className="mt-1 text-sm text-ink-soft">{credits} classes</p>
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-olive" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
