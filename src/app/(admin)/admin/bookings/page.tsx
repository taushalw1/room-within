import { CalendarCheck, CircleDollarSign, Hourglass } from "lucide-react";
import { BookingDecision } from "@/components/admin/BookingActions";
import { Stat } from "@/components/admin/Stat";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { getBookings, getRoomNameMap } from "@/lib/data/admin";
import { getRooms } from "@/lib/data/public";
import { dateTimeRange, hoursBetween, money } from "@/lib/format";

export default async function BookingsPage() {
  const [bookings, roomNames, rooms] = await Promise.all([
    getBookings(),
    getRoomNameMap(),
    getRooms(),
  ]);

  const now = new Date();
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.ends_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const unpaid = bookings.filter(
    (b) => b.status !== "cancelled" && !b.is_paid && b.total_cents > 0,
  );

  const hoursThisMonth = bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        new Date(b.starts_at).getMonth() === now.getMonth() &&
        new Date(b.starts_at).getFullYear() === now.getFullYear(),
    )
    .reduce((s, b) => s + hoursBetween(b.starts_at, b.ends_at), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Bookings</h1>
        <p className="mt-1.5 text-ink-soft">
          Requests to approve, what&rsquo;s coming up, and your room rates.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Waiting on you"
          value={String(pending.length)}
          sub="Requests to confirm"
          icon={Hourglass}
          tone={pending.length > 0 ? "bad" : "default"}
        />
        <Stat
          label="Confirmed ahead"
          value={String(upcoming.length)}
          sub="Bookings still to come"
          icon={CalendarCheck}
        />
        <Stat
          label="Hours booked"
          value={`${hoursThisMonth.toFixed(0)}h`}
          sub="This month, all rooms"
        />
        <Stat
          label="Unpaid bookings"
          value={money(unpaid.reduce((s, b) => s + b.total_cents, 0))}
          sub={`${unpaid.length} awaiting payment`}
          icon={CircleDollarSign}
        />
      </div>

      {/* ---------- Requests ---------- */}
      <Card className={pending.length ? "border-burgundy/25" : undefined}>
        <CardHeader
          title="Requests to approve"
          description="Nothing is confirmed and nobody is charged until you say yes."
        />
        <ul className="divide-y divide-tan/20">
          {pending.length === 0 ? (
            <li className="px-5 py-12 text-center text-sm text-ink-faint">
              No requests waiting.
            </li>
          ) : (
            pending.map((b) => (
              <li
                key={b.id}
                id={b.id}
                className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {roomNames.get(b.room_id) ?? "Room"} ·{" "}
                    {dateTimeRange(b.starts_at, b.ends_at)}
                    {b.attendees ? ` · ${b.attendees} people` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {b.booker_name} · {b.booker_email}
                    {b.booker_phone ? ` · ${b.booker_phone}` : ""}
                  </p>
                  {b.purpose && (
                    <p className="mt-2 rounded bg-parchment px-3 py-2 text-sm text-ink-soft">
                      {b.purpose}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <p className="font-display text-xl font-semibold text-olive-deep">
                    {money(b.total_cents)}
                  </p>
                  <BookingDecision bookingId={b.id} />
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      {/* ---------- Upcoming ---------- */}
      <Card>
        <CardHeader title="Coming up" />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Room</Th>
              <Th>What</Th>
              <Th>Who</Th>
              <Th align="right">Total</Th>
              <Th align="right">Paid</Th>
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 ? (
              <EmptyRow colSpan={6}>Nothing booked yet.</EmptyRow>
            ) : (
              upcoming.map((b) => (
                <tr key={b.id}>
                  <Td>{dateTimeRange(b.starts_at, b.ends_at)}</Td>
                  <Td>{roomNames.get(b.room_id) ?? "—"}</Td>
                  <Td>
                    {b.title}
                    {b.is_public && (
                      <span className="ml-2 align-middle">
                        <Badge tone="info">on calendar</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    {b.booker_name}
                    <span className="block text-xs text-ink-faint">
                      {b.booker_email}
                    </span>
                  </Td>
                  <Td align="right">{money(b.total_cents)}</Td>
                  <Td align="right">
                    <Badge tone={b.is_paid ? "good" : "warn"}>
                      {b.is_paid ? "paid" : "unpaid"}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Rates ---------- */}
      <Card>
        <CardHeader
          title="Rooms & rates"
          description="What each space costs. Ask Claude to change a rate or add a room."
        />
        <Table>
          <thead>
            <tr>
              <Th>Room</Th>
              <Th align="right">Seats</Th>
              <Th align="right">Hourly</Th>
              <Th align="right">Half day</Th>
              <Th align="right">Full day</Th>
              <Th align="right">Approval</Th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <Td>
                  <span className="font-medium">{r.name}</span>
                </Td>
                <Td align="right">{r.capacity ?? "—"}</Td>
                <Td align="right">{money(r.hourly_rate_cents)}</Td>
                <Td align="right">
                  {r.half_day_rate_cents ? money(r.half_day_rate_cents) : "—"}
                </Td>
                <Td align="right">
                  {r.full_day_rate_cents ? money(r.full_day_rate_cents) : "—"}
                </Td>
                <Td align="right">
                  <Badge tone={r.requires_approval ? "warn" : "good"}>
                    {r.requires_approval ? "you approve" : "instant"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
