import type { Metadata } from "next";
import { addDays } from "date-fns";
import { BookingForm } from "@/components/booking/BookingForm";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { Card, CardHeader } from "@/components/ui/Table";
import { getRoomBusyTimes, getRooms } from "@/lib/data/public";
import { dateTimeRange } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a Room",
  description: `Book a room at Room Within Community in ${site.town} — hourly, half-day and full-day.`,
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; cancelled?: string }>;
}) {
  const { room: roomParam, cancelled } = await searchParams;
  const rooms = await getRooms();

  const from = new Date();
  const to = addDays(from, 30);

  const busyByRoom = await Promise.all(
    rooms.map(async (r) => ({
      room: r,
      busy: await getRoomBusyTimes(r.id, from, to),
    })),
  );

  const anyBusy = busyByRoom.some((b) => b.busy.length > 0);

  return (
    <Section tint="cream">
      <Container>
        <SectionHeading
          eyebrow="Our Spaces"
          title="Book a room at"
          script="Room Within"
          lead="Pick a room, choose your time, and we'll take it from there. Community groups and non-profits — ask about reduced rates before you book."
        />

        {cancelled && (
          <p
            role="status"
            className="mx-auto mt-8 max-w-2xl rounded-[var(--radius-card)] border border-tan/40 bg-parchment px-5 py-4 text-center text-sm text-ink-soft"
          >
            No payment was taken and nothing was booked. You&rsquo;re welcome to
            start again below.
          </p>
        )}

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius-card)] border border-tan/25 bg-parchment/40 p-6 sm:p-8">
            <BookingForm rooms={rooms} initialRoomSlug={roomParam} />
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader
                title="Already booked"
                description="The next few weeks, so you can pick a time that's free."
              />
              <div className="px-5 py-4">
                {!anyBusy ? (
                  <p className="py-6 text-center text-sm text-ink-faint">
                    Nothing booked in the next month — the diary is wide open.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {busyByRoom
                      .filter((b) => b.busy.length > 0)
                      .map(({ room, busy }) => (
                        <li key={room.id}>
                          <h3 className="eyebrow !text-[0.6rem] text-bark">
                            {room.name}
                          </h3>
                          <ul className="mt-1.5 space-y-1">
                            {busy.slice(0, 6).map((slot, i) => (
                              <li key={i} className="text-sm text-ink-soft">
                                {dateTimeRange(slot.starts_at, slot.ends_at)}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card className="bg-sage-pale/40">
              <div className="px-5 py-5 text-sm text-ink-soft">
                <h3 className="font-display text-base font-semibold text-olive-deep">
                  Good to know
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-4">
                  <li>Tables and stacking chairs come with the room.</li>
                  <li>
                    Tick &ldquo;show on the community calendar&rdquo; if
                    you&rsquo;d like others to join you.
                  </li>
                  <li>
                    Need something that isn&rsquo;t here?{" "}
                    <a
                      href={`mailto:${site.email}`}
                      className="text-burgundy underline-offset-4 hover:underline"
                    >
                      Just ask
                    </a>
                    .
                  </li>
                </ul>
              </div>
            </Card>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
