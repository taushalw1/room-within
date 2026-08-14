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
import { requireUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { dateShort, moneyExact } from "@/lib/format";
import type { InvoiceRow } from "@/lib/data/types";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const user = await requireUser("/portal");

  let invoices: InvoiceRow[] = [];

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

  const owing = invoices
    .filter((i) => i.state === "overdue" || i.state === "outstanding")
    .reduce((s, i) => s + i.balance_cents, 0);

  return (
    <Section tint="cream">
      <Container>
        <header className="max-w-2xl">
          <h1 className="text-3xl">Your account</h1>
          <p className="mt-2 text-ink-soft">
            Signed in as {user.email}. Here&rsquo;s everything invoiced to you.
          </p>
        </header>

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
