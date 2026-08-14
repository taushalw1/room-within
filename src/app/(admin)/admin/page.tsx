import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Stat } from "@/components/admin/Stat";
import { Badge, Card, CardHeader, Table, Td, Th, EmptyRow } from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import { getContactNameMap, getDashboard, getRoomNameMap } from "@/lib/data/admin";
import { dateShort, dateTimeRange, money } from "@/lib/format";

export default async function AdminDashboard() {
  const [d, contacts, rooms] = await Promise.all([
    getDashboard(),
    getContactNameMap(),
    getRoomNameMap(),
  ]);

  const net = d.collectedThisMonth - d.expensesThisMonth;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Good day, Tausha</h1>
        <p className="mt-1.5 text-ink-soft">
          Here&rsquo;s where everything stands today.
        </p>
      </header>

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Overdue"
          value={money(d.overdueCents)}
          sub={`${d.overdue.length} invoice${d.overdue.length === 1 ? "" : "s"} past due`}
          icon={AlertTriangle}
          href="/admin/rentals?filter=overdue"
          tone={d.overdueCents > 0 ? "bad" : "default"}
        />
        <Stat
          label="Still to come in"
          value={money(d.outstandingCents)}
          sub={`${d.outstanding.length} not yet due`}
          icon={Clock}
          href="/admin/rentals"
        />
        <Stat
          label="Collected this month"
          value={money(d.collectedThisMonth)}
          sub="Rent, bookings and sessions"
          icon={Wallet}
          href="/admin/finance"
        />
        <Stat
          label="Spent this month"
          value={money(d.expensesThisMonth)}
          sub={`Net ${net >= 0 ? "+" : ""}${money(net)}`}
          icon={TrendingDown}
          href="/admin/finance"
        />
      </div>

      {/* Things waiting on her */}
      {(d.pendingBookings.length > 0 || d.newRequests.length > 0) && (
        <Card className="border-burgundy/25 bg-blush/30">
          <CardHeader
            title="Waiting for you"
            description="These need a yes or no before anything else happens."
          />
          <ul className="divide-y divide-tan/20">
            {d.pendingBookings.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{b.booker_name}</span> asked
                    for {rooms.get(b.room_id) ?? "a room"}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {b.title} · {dateTimeRange(b.starts_at, b.ends_at)}
                  </p>
                </div>
                <ButtonLink
                  href={`/admin/bookings#${b.id}`}
                  size="sm"
                  variant="secondary"
                >
                  Review
                </ButtonLink>
              </li>
            ))}
            {d.newRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{r.full_name}</span>{" "}
                    requested counselling
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {r.message ?? "No message"}
                  </p>
                </div>
                <ButtonLink
                  href="/admin/counselling#requests"
                  size="sm"
                  variant="secondary"
                >
                  Open
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue */}
        <Card>
          <CardHeader
            title="Overdue payments"
            action={
              <ButtonLink
                href="/admin/rentals?filter=overdue"
                size="sm"
                variant="ghost"
              >
                See all
              </ButtonLink>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Who</Th>
                <Th>Due</Th>
                <Th align="right">Owing</Th>
              </tr>
            </thead>
            <tbody>
              {d.overdue.length === 0 ? (
                <EmptyRow colSpan={3}>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sage" aria-hidden />
                    Nothing overdue — everyone&rsquo;s up to date.
                  </span>
                </EmptyRow>
              ) : (
                d.overdue.slice(0, 6).map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <Link
                        href={`/admin/rentals/${i.id}`}
                        className="hover:text-burgundy"
                      >
                        {contacts.get(i.contact_id)?.full_name ?? "—"}
                      </Link>
                      <span className="block text-xs text-ink-faint">
                        {i.description}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="bad">{i.days_overdue}d late</Badge>
                      <span className="block text-xs text-ink-faint">
                        {dateShort(i.due_date)}
                      </span>
                    </Td>
                    <Td align="right" className="font-semibold text-burgundy">
                      {money(i.balance_cents)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        {/* Coming up */}
        <Card>
          <CardHeader
            title="Coming up"
            description="Bookings and sessions in the next while."
          />
          <ul className="divide-y divide-tan/15">
            {[
              ...d.upcomingBookings.slice(0, 4).map((b) => ({
                id: b.id,
                when: b.starts_at,
                title: b.title,
                sub: `${rooms.get(b.room_id) ?? "Room"} · ${b.booker_name}`,
                range: dateTimeRange(b.starts_at, b.ends_at),
                tone: b.status === "pending" ? ("warn" as const) : ("good" as const),
                label: b.status,
              })),
              ...d.upcomingAppointments.slice(0, 3).map((a) => ({
                id: a.id,
                when: a.starts_at,
                title: "Counselling session",
                sub: a.client_name,
                range: dateTimeRange(a.starts_at, a.ends_at),
                tone: "info" as const,
                label: a.kind,
              })),
            ]
              .sort((x, y) => x.when.localeCompare(y.when))
              .slice(0, 6)
              .map((item) => (
                <li key={item.id} className="flex gap-3 px-5 py-3.5">
                  <CalendarClock
                    className="mt-0.5 h-4 w-4 shrink-0 text-sage"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-ink-soft">{item.sub}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{item.range}</p>
                  </div>
                  <Badge tone={item.tone}>{item.label}</Badge>
                </li>
              ))}
            {d.upcomingBookings.length === 0 &&
              d.upcomingAppointments.length === 0 && (
                <li className="px-5 py-12 text-center text-sm text-ink-faint">
                  Nothing booked yet.
                </li>
              )}
          </ul>
        </Card>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader
          title="Your to-do list"
          description="Private to you."
          action={
            <ButtonLink href="/admin/counselling#tasks" size="sm" variant="ghost">
              <Inbox className="h-4 w-4" aria-hidden />
              Open list
            </ButtonLink>
          }
        />
        <ul className="divide-y divide-tan/15">
          {d.openTasks.length === 0 ? (
            <li className="px-5 py-12 text-center text-sm text-ink-faint">
              Nothing on the list.
            </li>
          ) : (
            d.openTasks.slice(0, 5).map((t) => {
              const overdue =
                t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
              return (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{t.title}</p>
                    {t.notes && (
                      <p className="text-xs text-ink-soft">{t.notes}</p>
                    )}
                  </div>
                  {t.due_date && (
                    <Badge tone={overdue ? "bad" : "neutral"}>
                      {dateShort(t.due_date)}
                    </Badge>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </Card>
    </div>
  );
}
