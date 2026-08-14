import Link from "next/link";
import { Building2 } from "lucide-react";
import { Stat } from "@/components/admin/Stat";
import {
  RecordPaymentForm,
  SendReminderButton,
} from "@/components/admin/InvoiceActions";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import {
  getContactNameMap,
  getInvoices,
  getLeases,
  getUnits,
} from "@/lib/data/admin";
import { dateShort, money } from "@/lib/format";
import type { InvoiceState } from "@/lib/data/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "outstanding", label: "Not yet due" },
  { key: "paid", label: "Paid" },
] as const;

const stateTone: Record<InvoiceState, "good" | "bad" | "warn" | "neutral"> = {
  paid: "good",
  overdue: "bad",
  outstanding: "warn",
  draft: "neutral",
  void: "neutral",
};

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;

  const [invoices, units, leases, contacts] = await Promise.all([
    getInvoices(),
    getUnits(),
    getLeases(),
    getContactNameMap(),
  ]);

  const shown =
    filter === "all" ? invoices : invoices.filter((i) => i.state === filter);

  const overdueCents = invoices
    .filter((i) => i.state === "overdue")
    .reduce((s, i) => s + i.balance_cents, 0);
  const outstandingCents = invoices
    .filter((i) => i.state === "outstanding")
    .reduce((s, i) => s + i.balance_cents, 0);
  const monthlyRentRoll = leases.reduce((s, l) => s + l.rent_cents, 0);

  const leaseByUnit = new Map(leases.map((l) => [l.unit_id, l]));
  const occupied = leases.length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Rentals</h1>
        <p className="mt-1.5 text-ink-soft">
          Who&rsquo;s renting what, what&rsquo;s been paid, and what&rsquo;s
          late.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Overdue"
          value={money(overdueCents)}
          tone={overdueCents > 0 ? "bad" : "default"}
          sub="Past the due date"
        />
        <Stat
          label="Not yet due"
          value={money(outstandingCents)}
          sub="Invoiced, still to come"
        />
        <Stat
          label="Monthly rent roll"
          value={money(monthlyRentRoll)}
          sub="From active leases"
        />
        <Stat
          label="Occupancy"
          value={`${occupied}/${units.length}`}
          sub="Units with an active lease"
          icon={Building2}
        />
      </div>

      {/* ---------- Units ---------- */}
      <Card>
        <CardHeader
          title="The building"
          description="Each rentable space and who's currently in it."
        />
        <Table>
          <thead>
            <tr>
              <Th>Unit</Th>
              <Th>Type</Th>
              <Th>Tenant</Th>
              <Th align="right">Rent</Th>
              <Th align="right">Due</Th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <EmptyRow colSpan={5}>
                No units yet. Ask Claude to add one.
              </EmptyRow>
            ) : (
              units.map((u) => {
                const lease = leaseByUnit.get(u.id);
                const tenant = lease ? contacts.get(lease.contact_id) : null;
                return (
                  <tr key={u.id}>
                    <Td>
                      <span className="font-medium">{u.name}</span>
                      {u.floor && (
                        <span className="block text-xs text-ink-faint">
                          {u.floor} floor
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge>{u.kind}</Badge>
                    </Td>
                    <Td>
                      {tenant ? (
                        <>
                          {tenant.full_name}
                          {tenant.organisation && (
                            <span className="block text-xs text-ink-faint">
                              {tenant.organisation}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-faint">Vacant</span>
                      )}
                    </Td>
                    <Td align="right">
                      {money(lease?.rent_cents ?? u.monthly_rate_cents)}
                      <span className="block text-xs text-ink-faint">
                        / month
                      </span>
                    </Td>
                    <Td align="right">
                      {lease ? (
                        <span className="text-sm">
                          {lease.due_day}
                          <span className="text-xs text-ink-faint">
                            {lease.due_day === 1
                              ? "st"
                              : lease.due_day === 2
                                ? "nd"
                                : lease.due_day === 3
                                  ? "rd"
                                  : "th"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Invoices ---------- */}
      <Card>
        <CardHeader
          title="Payments"
          description="Everything invoiced — rent, room bookings and sessions."
          action={
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={`/admin/rentals?filter=${f.key}`}
                  className={cn(
                    "eyebrow rounded-full px-3 py-1.5 !text-[0.58rem] transition-colors",
                    filter === f.key
                      ? "bg-olive text-cream"
                      : "text-bark hover:bg-sage-pale/70",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Who</Th>
              <Th>Due</Th>
              <Th align="right">Owing</Th>
              <Th align="right">Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <EmptyRow colSpan={6}>
                {filter === "overdue"
                  ? "Nothing overdue — everyone's up to date."
                  : "Nothing here."}
              </EmptyRow>
            ) : (
              shown.map((i) => {
                const contact = contacts.get(i.contact_id);
                return (
                  <tr key={i.id}>
                    <Td>
                      <span className="font-mono text-xs text-ink-soft">
                        {i.number}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {i.description}
                      </span>
                    </Td>
                    <Td>
                      {contact?.full_name ?? "—"}
                      {contact?.email && (
                        <span className="block text-xs text-ink-faint">
                          {contact.email}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {dateShort(i.due_date)}
                      {i.state === "overdue" && (
                        <span className="block text-xs text-burgundy">
                          {i.days_overdue} days late
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {i.balance_cents > 0 ? (
                        money(i.balance_cents)
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <Badge tone={stateTone[i.state]}>{i.state}</Badge>
                    </Td>
                    <Td align="right">
                      {i.balance_cents > 0 && (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {i.state === "overdue" && (
                            <SendReminderButton invoiceId={i.id} />
                          )}
                          <RecordPaymentForm
                            invoiceId={i.id}
                            contactId={i.contact_id}
                            balanceCents={i.balance_cents}
                          />
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs text-ink-faint">
        Reminder emails go out automatically: a few days before rent is due, on
        the day, and again at 3, 7 and 14 days late. Nobody gets the same
        reminder twice.
      </p>
    </div>
  );
}
