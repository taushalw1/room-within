import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { requireUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { dateShort, dateTimeRange, moneyExact } from "@/lib/format";
import type { BookingRow, InvoiceRow } from "@/lib/data/types";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const user = await requireUser("/portal");

  let invoices: InvoiceRow[] = [];
  let bookings: (BookingRow & { rooms: { name: string } | null })[] = [];

  if (user.contactId) {
    const supabase = await getServerSupabase();
    // Row-level security limits this to the signed-in person's own invoices.
    const { data } = (await supabase
      ?.from("invoice_balances")
      .select("*")
      .eq("contact_id", user.contactId)
      .order("due_date", { ascending: false })) ?? { data: null };

    invoices = (data as InvoiceRow[]) ?? [];
  }

  {
    const supabase = await getServerSupabase();
    // Row-level security matches on the signed-in email, so this returns only
    // their own bookings without needing a filter here.
    const { data } = (await supabase
      ?.from("bookings")
      .select("*, rooms:room_id (name)")
      .gte("ends_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("starts_at")) ?? { data: null };

    bookings = (data as typeof bookings) ?? [];
  }

  const owing = invoices
    .filter((i) => i.state === "overdue" || i.state === "outstanding")
    .reduce((s, i) => s + i.balance_cents, 0);

  return (
    <Section tint="cream">
      <Container>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl">
              Hello{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-2 text-ink-soft">
              Signed in as {user.email}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/book" size="sm">
              Book a room
            </ButtonLink>
            <ButtonLink href="/calendar" variant="secondary" size="sm">
              What&rsquo;s on
            </ButtonLink>
          </div>
        </header>

        <Card className="mt-8">
          <CardHeader
            title="Your bookings"
            description="Rooms you have coming up."
          />
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Room</Th>
                <Th>What</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <EmptyRow colSpan={4}>
                  Nothing booked yet.{" "}
                  <a href="/book" className="text-burgundy underline-offset-4 hover:underline">
                    Book a room
                  </a>
                  .
                </EmptyRow>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id}>
                    <Td>{dateTimeRange(b.starts_at, b.ends_at)}</Td>
                    <Td>{b.rooms?.name ?? "—"}</Td>
                    <Td>{b.title}</Td>
                    <Td align="right">
                      <Badge tone={b.status === "confirmed" ? "good" : "warn"}>
                        {b.status}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        {owing > 0 && (
          <p className="mt-6 inline-block rounded-[var(--radius-card)] border border-burgundy/25 bg-blush/40 px-5 py-3 text-sm">
            Currently owing{" "}
            <strong className="text-burgundy">{moneyExact(owing)}</strong>
          </p>
        )}

        <Card className="mt-8">
          <CardHeader title="Your invoices" />
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>What for</Th>
                <Th>Due</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <EmptyRow colSpan={5}>
                  Nothing here yet. If you think something should be, email{" "}
                  {site.email}.
                </EmptyRow>
              ) : (
                invoices.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-mono text-xs text-ink-soft">
                      {i.number}
                    </Td>
                    <Td>{i.description}</Td>
                    <Td>{dateShort(i.due_date)}</Td>
                    <Td align="right" className="font-semibold">
                      {moneyExact(i.amount_cents + i.tax_cents)}
                    </Td>
                    <Td align="right">
                      <Badge
                        tone={
                          i.state === "paid"
                            ? "good"
                            : i.state === "overdue"
                              ? "bad"
                              : "warn"
                        }
                      >
                        {i.state}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        <p className="mt-6 text-sm text-ink-soft">
          Questions about anything here? Email{" "}
          <a
            href={`mailto:${site.email}`}
            className="text-burgundy underline-offset-4 hover:underline"
          >
            {site.email}
          </a>{" "}
          — and if paying is difficult right now, please say so. We&rsquo;d
          rather know.
        </p>
      </Container>
    </Section>
  );
}
