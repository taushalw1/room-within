import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, differenceInCalendarDays, format } from "date-fns";

/**
 * What Tausha needs to know before the day starts.
 *
 * The test for whether something belongs here is whether it changes what she
 * does today. A total that has been the same for a fortnight does not; a
 * tenant whose lease quietly ends in six weeks does, because six weeks is
 * about how long it takes to find the next one.
 *
 * Everything is read in one place so the email and the dashboard can't drift
 * apart and start telling her different things.
 */

export type DigestLine = { text: string; urgent?: boolean };

export type Digest = {
  date: string;
  money: {
    overdueCents: number;
    overdueCount: number;
    dueTodayCents: number;
    dueTodayCount: number;
    paidYesterdayCents: number;
  };
  repairs: DigestLine[];
  today: DigestLine[];
  building: DigestLine[];
  leases: DigestLine[];
  moveOuts: DigestLine[];
  /** True when there is genuinely nothing worth an email. */
  quiet: boolean;
};

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (d: Date) => format(d, "yyyy-MM-dd");

export async function buildDigest(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<Digest> {
  const today = day(now);
  const yesterday = day(addDays(now, -1));

  const [
    invoiceRes,
    repairRes,
    bookingRes,
    eventRes,
    leaseRes,
    moveOutRes,
    paymentRes,
    taskRes,
    warrantyRes,
  ] = await Promise.all([
      supabase
        .from("invoice_balances")
        .select("*, contacts:contact_id (full_name)")
        .in("state", ["overdue", "outstanding"]),
      supabase
        .from("maintenance_requests")
        .select("id, title, urgency, status, reported_by, created_at")
        .in("status", ["new", "seen", "doing"])
        .order("created_at", { ascending: true }),
      supabase
        .from("bookings")
        .select("starts_at, ends_at, purpose, status, rooms:room_id (name)")
        .gte("starts_at", `${today}T00:00:00`)
        .lte("starts_at", `${today}T23:59:59`)
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase
        .from("events")
        .select("title, starts_at")
        .gte("starts_at", `${today}T00:00:00`)
        .lte("starts_at", `${today}T23:59:59`)
        .order("starts_at"),
      supabase
        .from("leases")
        .select("id, end_date, unit_id, contact_id, contacts:contact_id (full_name), units:unit_id (name)")
        .eq("status", "active")
        .not("end_date", "is", null),
      supabase
        .from("move_outs")
        .select("id, leaving_on, status, contacts:contact_id (full_name)")
        .neq("status", "settled")
        .order("leaving_on"),
      supabase
        .from("payments")
        .select("amount_cents, received_at")
        .gte("received_at", `${yesterday}T00:00:00`)
        .lte("received_at", `${yesterday}T23:59:59`),
      supabase
        .from("recurring_tasks")
        .select("title, next_due_on, area")
        .eq("is_active", true)
        .lte("next_due_on", day(addDays(now, 7)))
        .order("next_due_on"),
      supabase
        .from("warranties")
        .select("item, expires_on, supplier")
        .not("expires_on", "is", null)
        .gte("expires_on", today)
        .lte("expires_on", day(addDays(now, 60)))
        .order("expires_on"),
    ]);

  type Named = { full_name: string } | null;

  const invoices =
    (invoiceRes.data as unknown as {
      state: string;
      balance_cents: number;
      due_date: string;
      days_overdue: number;
      number: string | null;
      contacts: Named;
    }[]) ?? [];

  const overdue = invoices.filter((i) => i.state === "overdue");
  const dueToday = invoices.filter((i) => i.due_date === today);

  const payments = (paymentRes.data as { amount_cents: number }[]) ?? [];

  /* --- Repairs waiting ----------------------------------------------------- */

  const repairs =
    (repairRes.data as {
      title: string;
      urgency: string;
      status: string;
      reported_by: string;
      created_at: string;
    }[]) ?? [];

  const repairLines: DigestLine[] = repairs.map((r) => {
    const age = differenceInCalendarDays(now, new Date(r.created_at));
    const waited =
      age === 0 ? "reported today" : age === 1 ? "waiting a day" : `waiting ${age} days`;
    return {
      text: `${r.title} — ${r.reported_by}, ${waited}`,
      // Urgent, or anything that has sat untouched for a week. A repair nobody
      // has acknowledged for a week is how a tenant decides not to report the
      // next one.
      urgent: r.urgency === "urgent" || (r.status === "new" && age >= 7),
    };
  });

  /* --- What is actually happening in the building today -------------------- */

  const bookings =
    (bookingRes.data as unknown as {
      starts_at: string;
      ends_at: string;
      purpose: string | null;
      status: string;
      rooms: { name: string } | null;
    }[]) ?? [];

  const events = (eventRes.data as { title: string; starts_at: string }[]) ?? [];

  const time = (iso: string) => format(new Date(iso), "h:mm a");

  const todayLines: DigestLine[] = [
    ...bookings.map((b) => ({
      text: `${time(b.starts_at)} — ${b.rooms?.name ?? "A room"}${b.purpose ? `, ${b.purpose}` : ""}${
        b.status === "pending" ? " (still unconfirmed)" : ""
      }`,
      urgent: b.status === "pending",
    })),
    ...events.map((e) => ({ text: `${time(e.starts_at)} — ${e.title}` })),
  ].sort((a, b) => a.text.localeCompare(b.text));

  /* --- Tenancies running out ----------------------------------------------- */

  // Ninety days, because that is roughly how long it takes to find the next
  // tenant, and a lease that ends with nobody lined up is an empty month.
  const leases =
    (leaseRes.data as unknown as {
      end_date: string;
      contacts: Named;
      units: { name: string } | null;
    }[]) ?? [];

  const leaseLines: DigestLine[] = leases
    .map((l) => ({ ...l, days: differenceInCalendarDays(new Date(`${l.end_date}T00:00:00`), now) }))
    .filter((l) => l.days >= 0 && l.days <= 90)
    .sort((a, b) => a.days - b.days)
    .map((l) => ({
      text: `${l.units?.name ?? "A unit"} — ${l.contacts?.full_name ?? "tenant"}, lease ends in ${
        l.days === 0 ? "today" : l.days === 1 ? "a day" : `${l.days} days`
      }`,
      urgent: l.days <= 30,
    }));

  /* --- Move-outs in progress ------------------------------------------------ */

  const moveOuts =
    (moveOutRes.data as unknown as {
      leaving_on: string;
      status: string;
      contacts: Named;
    }[]) ?? [];

  const moveOutLines: DigestLine[] = moveOuts.map((m) => {
    const days = differenceInCalendarDays(new Date(`${m.leaving_on}T00:00:00`), now);
    const when =
      days < 0 ? `left ${-days} days ago` : days === 0 ? "leaving today" : `leaving in ${days} days`;
    const state =
      m.status === "open"
        ? "still working through the list"
        : m.status === "tenant_done"
          ? "signed — walk-through next"
          : "walk-through done, deposit to settle";
    return {
      text: `${m.contacts?.full_name ?? "A tenant"} — ${when}, ${state}`,
      urgent: days <= 0 && m.status !== "inspected",
    };
  });

  /* --- The building itself -------------------------------------------------- */

  // Only what is due inside a week, or already late. A furnace service booked
  // for next spring is not a thing she needs to think about this morning.
  const tasks =
    (taskRes.data as unknown as {
      title: string;
      next_due_on: string;
      area: string | null;
    }[]) ?? [];

  const warranties =
    (warrantyRes.data as unknown as {
      item: string;
      expires_on: string;
      supplier: string | null;
    }[]) ?? [];

  const buildingLines: DigestLine[] = [
    ...tasks.map((t) => {
      const days = differenceInCalendarDays(new Date(`${t.next_due_on}T00:00:00`), now);
      const when =
        days < 0
          ? `${-days} ${-days === 1 ? "day" : "days"} late`
          : days === 0
            ? "due today"
            : `due in ${days} ${days === 1 ? "day" : "days"}`;
      return {
        text: `${t.title}${t.area ? ` (${t.area})` : ""} — ${when}`,
        urgent: days < 0,
      };
    }),
    ...warranties.map((w) => {
      const days = differenceInCalendarDays(new Date(`${w.expires_on}T00:00:00`), now);
      return {
        text: `${w.item} — cover runs out in ${days} ${days === 1 ? "day" : "days"}${
          w.supplier ? `, ${w.supplier}` : ""
        }`,
        // Worth a look while there is still time to make a claim.
        urgent: days <= 14,
      };
    }),
  ];

  const moneyBits = {
    overdueCents: overdue.reduce((t, i) => t + i.balance_cents, 0),
    overdueCount: overdue.length,
    dueTodayCents: dueToday.reduce((t, i) => t + i.balance_cents, 0),
    dueTodayCount: dueToday.length,
    paidYesterdayCents: payments.reduce((t, p) => t + p.amount_cents, 0),
  };

  return {
    date: today,
    money: moneyBits,
    repairs: repairLines,
    today: todayLines,
    building: buildingLines,
    leases: leaseLines,
    moveOuts: moveOutLines,
    // Overdue money alone isn't news — it was overdue yesterday too. The email
    // is worth sending when something in the day needs her, or when money
    // actually moved.
    quiet:
      repairLines.length === 0 &&
      todayLines.length === 0 &&
      buildingLines.length === 0 &&
      leaseLines.length === 0 &&
      moveOutLines.length === 0 &&
      moneyBits.dueTodayCount === 0 &&
      moneyBits.paidYesterdayCents === 0,
  };
}

/** The same thing as plain sentences, for the email's text part. */
export function digestAsText(d: Digest): string {
  const section = (title: string, lines: DigestLine[]) =>
    lines.length === 0 ? "" : `\n${title}\n${lines.map((l) => `  - ${l.text}`).join("\n")}\n`;

  return [
    `Room Within — ${d.date}`,
    ``,
    `Overdue: ${money(d.money.overdueCents)} across ${d.money.overdueCount}.`,
    d.money.dueTodayCount > 0
      ? `Due today: ${money(d.money.dueTodayCents)} across ${d.money.dueTodayCount}.`
      : `Nothing falls due today.`,
    d.money.paidYesterdayCents > 0
      ? `Came in yesterday: ${money(d.money.paidYesterdayCents)}.`
      : ``,
    section("Today", d.today),
    section("Repairs waiting", d.repairs),
    section("The building", d.building),
    section("Tenancies ending", d.leases),
    section("Move-outs", d.moveOuts),
  ]
    .filter(Boolean)
    .join("\n");
}
