import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { Card } from "@/components/ui/Table";

export const metadata: Metadata = {
  title: "Add the calendar to yours",
  description:
    "Subscribe to the Room Within community calendar in Google Calendar, Apple Calendar or Outlook.",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const FEED = `${SITE_URL}/api/calendar/community.ics`;

const steps = [
  {
    app: "Google Calendar",
    detail:
      "On a computer, open Google Calendar. Beside 'Other calendars' on the left, click +, choose 'From URL', paste the address, and click 'Add calendar'.",
  },
  {
    app: "Apple Calendar (iPhone, iPad or Mac)",
    detail:
      "On a Mac: File → New Calendar Subscription, then paste the address. On an iPhone or iPad: Settings → Apps → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar.",
  },
  {
    app: "Outlook",
    detail:
      "Open Outlook on the web, go to Calendar, choose 'Add calendar' → 'Subscribe from web', and paste the address.",
  },
];

export default function SubscribePage() {
  return (
    <Section tint="cream">
      <Container>
        <SectionHeading
          eyebrow="Community Calendar"
          title="Keep it in your own"
          script="calendar"
          lead="Subscribe once, and everything happening at Room Within and around Grassy Lake shows up alongside your own appointments — updating on its own as things are added."
        />

        <Card className="mx-auto mt-12 max-w-2xl">
          <div className="border-b border-tan/20 px-6 py-5">
            <h2 className="eyebrow text-bark">The calendar address</h2>
            <p className="mt-3 break-all rounded-[var(--radius-card)] bg-parchment px-4 py-3 font-mono text-sm text-olive-deep">
              {FEED}
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              Copy that address, then follow the steps for whichever calendar
              you use.
            </p>
          </div>

          <ol className="divide-y divide-tan/15">
            {steps.map((s, i) => (
              <li key={s.app} className="flex gap-4 px-6 py-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-pale font-display font-semibold text-olive-deep">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-olive-deep">
                    {s.app}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {s.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex items-start gap-3 border-t border-tan/20 px-6 py-5 text-sm text-ink-soft">
            <CalendarPlus className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
            <p>
              Subscribed calendars are read-only, and can take a few hours to
              pick up changes — that&rsquo;s the calendar app&rsquo;s own
              refresh schedule, not something we control.
            </p>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
