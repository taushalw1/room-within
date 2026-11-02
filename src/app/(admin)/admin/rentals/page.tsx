import Link from "next/link";
import { getOccupancy } from "@/lib/data/maintenance";
import { PageHeader } from "@/components/admin/PageHeader";
import { Building2 } from "lucide-react";
import { AddPanel } from "@/components/admin/AddPanel";
import { GenerateRentButton } from "@/components/admin/GenerateRentButton";
import { InvoiceForm } from "@/components/admin/InvoiceForm";
import { AddTenantForm } from "@/components/admin/AddTenantForm";
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
import { TenancyRow } from "@/components/admin/TenancyRow";
import { StartMoveOutForm } from "@/components/admin/MoveOutAdmin";
import { getMoveOuts } from "@/lib/data/move-out";
import {
  getAllLeases,
  getContactNameMap,
  getContacts,
  getInvoices,
  getUnits,
} from "@/lib/data/admin";
import { dateShort, money, moneyExact } from "@/lib/format";
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

  const [invoices, units, allLeases, contacts, contactList, occupancy, moveOuts] =
    await Promise.all([
      getInvoices(),
      getUnits(),
      getAllLeases(),
      getContactNameMap(),
      getContacts(),
      getOccupancy(),
      getMoveOuts(),
    ]);

  const leaving = moveOuts.filter((m) => m.status !== "settled");

  const leases = allLeases.filter((l) => l.status === "active");
  const endedLeases = allLeases.filter((l) => l.status === "ended");
  const unitsById = new Map(units.map((u) => [u.id, u]));

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
      <PageHeader
        eyebrow="Tenancies"
        title="Rentals"
        description="Who&rsquo;s renting what, what&rsquo;s been paid, and what&rsquo;s late."
      />

      {/* ---------- Who's where ---------- */}
      <Card>
        <CardHeader
          title="Who's in which room"
          tone="olive"
          description="Every room, who's in it, how to reach them and what they pay. Taken from the active tenancies, so it can't fall out of step with them."
        />
        <Table>
          <thead>
            <tr>
              <Th>Room</Th>
              <Th>Who's in it</Th>
              <Th>How to reach them</Th>
              <Th align="right">Rent</Th>
              <Th align="right">Due</Th>
            </tr>
          </thead>
          <tbody>
            {occupancy.length === 0 ? (
              <EmptyRow colSpan={5}>No rooms set up yet.</EmptyRow>
            ) : (
              occupancy.map((o) => (
                <tr key={o.unit.id}>
                  <Td>
                    <span className="font-medium">{o.unit.name}</span>
                    {o.unit.floor && (
                      <span className="block text-xs text-ink-faint">
                        {o.unit.floor}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {o.occupant ? (
                      o.occupant.name
                    ) : (
                      <Badge tone="warn">empty</Badge>
                    )}
                  </Td>
                  <Td>
                    {o.occupant?.email && (
                      <a
                        href={`mailto:${o.occupant.email}`}
                        className="text-burgundy hover:underline"
                      >
                        {o.occupant.email}
                      </a>
                    )}
                    {o.occupant?.phone && (
                      <span className="block text-xs text-ink-faint">
                        {o.occupant.phone}
                      </span>
                    )}
                    {!o.occupant && <span className="text-ink-faint">—</span>}
                  </Td>
                  <Td align="right">
                    {o.lease
                      ? moneyExact(o.lease.rent_cents)
                      : o.unit.monthly_rate_cents
                        ? `${moneyExact(o.unit.monthly_rate_cents)} asking`
                        : "—"}
                  </Td>
                  <Td align="right">
                    {o.lease ? `${o.lease.due_day}${o.lease.due_day === 1 ? "st" : o.lease.due_day === 2 ? "nd" : o.lease.due_day === 3 ? "rd" : "th"}` : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          To change who is in a room, edit their tenancy below. To add a room,
          use the settings page.
        </p>
      </Card>

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

      <AddPanel
        label="Add a tenant"
        description="Adds them to your people list, and sets up a lease if they're renting a unit."
      >
        <AddTenantForm units={units} />
      </AddPanel>

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
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <EmptyRow colSpan={6}>
                No units yet. Ask Claude to add one.
              </EmptyRow>
            ) : (
              units.map((u) => {
                const lease = leaseByUnit.get(u.id);
                return (
                  <TenancyRow
                    key={u.id}
                    unit={u}
                    lease={lease}
                    tenant={lease ? contacts.get(lease.contact_id) : undefined}
                    units={units}
                  />
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Ending ---------- */}
      <Card>
        <CardHeader
          title="Leaving"
          description="The clean-out list, the walk-through and the deposit, in one place — so the end of a tenancy is a record rather than a memory."
        />
        {leaving.length > 0 && (
          <ul className="divide-y divide-tan/20 border-b border-tan/20">
            {leaving.map((m) => {
              const who = m.contact_id ? contacts.get(m.contact_id)?.full_name : null;
              const unit = units.find((u) => u.id === m.unit_id);
              return (
                <li key={m.id}>
                  <Link
                    href={`/admin/rentals/move-out/${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-sage-pale/30"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">
                        {who ?? "A tenant"}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {unit?.name ?? "Unit"} · out {dateShort(m.leaving_on)}
                      </span>
                    </span>
                    <Badge
                      tone={
                        m.status === "open"
                          ? "warn"
                          : m.status === "tenant_done"
                            ? "info"
                            : "good"
                      }
                    >
                      {m.status === "open"
                        ? "With them"
                        : m.status === "tenant_done"
                          ? "Signed — walk-through next"
                          : "Inspected"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <StartMoveOutForm
          tenancies={leases
            .filter((l) => !leaving.some((m) => m.lease_id === l.id))
            .map((l) => ({
              id: l.id,
              label: `${units.find((u) => u.id === l.unit_id)?.name ?? "Unit"} — ${
                contacts.get(l.contact_id)?.full_name ?? "tenant"
              }`,
            }))}
        />
      </Card>

      {/* ---------- Past tenancies ---------- */}
      {endedLeases.length > 0 && (
        <Card>
          <CardHeader
            title="Past tenancies"
            description="Kept on file so their invoices and payments still make sense."
          />
          <Table>
            <thead>
              <tr>
                <Th>Tenant</Th>
                <Th>Unit</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th align="right">Rent was</Th>
              </tr>
            </thead>
            <tbody>
              {endedLeases.map((l) => (
                <tr key={l.id} className="opacity-70">
                  <Td>{contacts.get(l.contact_id)?.full_name ?? "—"}</Td>
                  <Td>{unitsById.get(l.unit_id)?.name ?? "—"}</Td>
                  <Td>{dateShort(l.start_date)}</Td>
                  <Td>{l.end_date ? dateShort(l.end_date) : "—"}</Td>
                  <Td align="right">{money(l.rent_cents)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <AddPanel
        label="Create an invoice"
        description="A one-off charge. Monthly rent is raised automatically."
      >
        <InvoiceForm contacts={contactList} />
      </AddPanel>

      {/* ---------- Invoices ---------- */}
      <Card>
        <CardHeader
          title="Payments"
          description="Everything invoiced — rent, room bookings and sessions."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <GenerateRentButton />
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
