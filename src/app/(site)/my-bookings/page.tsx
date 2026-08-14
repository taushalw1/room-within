import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/Section";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { dateTimeRange, moneyExact } from "@/lib/format";
import type { BookingRow } from "@/lib/data/types";

export const metadata: Metadata = {
  title: "Your bookings",
  robots: { index: false, follow: false },
};

export default async function MyBookingsPage() {
  await requireUser("/my-bookings");

  const supabase = await getServerSupabase();
  // Row-level security matches on the signed-in email, so this returns only
  // the visitor's own bookings without needing a filter here.
  const { data } = (await supabase
    ?.from("bookings")
    .select("*, rooms:room_id (name)")
    .order("starts_at", { ascending: false })) ?? { data: null };

  const bookings = (data as (BookingRow & { rooms: { name: string } | null })[]) ?? [];
  const now = new Date();

  return (
    <Section tint="cream">
      <Container>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Your bookings</h1>
            <p className="mt-2 text-ink-soft">
              Rooms you&rsquo;ve booked at Room Within.
            </p>
          </div>
          <ButtonLink href="/book" size="md">
            Book another
          </ButtonLink>
        </header>

        <Card className="mt-8">
          <CardHeader title="All bookings" />
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Room</Th>
                <Th>What</Th>
                <Th align="right">Total</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <EmptyRow colSpan={5}>
                  You haven&rsquo;t booked anything yet.
                </EmptyRow>
              ) : (
                bookings.map((b) => {
                  const past = new Date(b.ends_at) < now;
                  return (
                    <tr key={b.id} className={past ? "opacity-60" : undefined}>
                      <Td>{dateTimeRange(b.starts_at, b.ends_at)}</Td>
                      <Td>{b.rooms?.name ?? "—"}</Td>
                      <Td>{b.title}</Td>
                      <Td align="right">{moneyExact(b.total_cents)}</Td>
                      <Td align="right">
                        <Badge
                          tone={
                            b.status === "confirmed"
                              ? "good"
                              : b.status === "cancelled"
                                ? "bad"
                                : "warn"
                          }
                        >
                          {b.status}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Card>
      </Container>
    </Section>
  );
}
