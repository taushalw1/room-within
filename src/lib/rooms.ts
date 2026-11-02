import { differenceInCalendarDays } from "date-fns";
import type { LeaseRow, UnitRow } from "@/lib/data/types";

/**
 * What each room brought in, what it cost, and what it is costing while empty.
 *
 * Only money that is genuinely one room's is counted against it. Insurance,
 * heating and the accountant are the building's, not Suite 2's, and dividing
 * them by floor area would produce a figure that looks precise and tells you
 * nothing. The page says as much, so the number is read for what it is: rent
 * in, repairs out.
 */

export type RoomYear = {
  unit: UnitRow;
  /** Rent and bookings actually received, not invoiced. */
  receivedCents: number;
  /** Repairs and anything else attributed to this room. */
  spentCents: number;
  netCents: number;
  /** Days in the period with nobody in it. */
  emptyDays: number;
  /** What those empty days cost at the asking rate. */
  vacancyCents: number;
  occupant: string | null;
};

export function roomYear(args: {
  unit: UnitRow;
  leases: LeaseRow[];
  occupantName: string | null;
  receivedCents: number;
  spentCents: number;
  from: Date;
  to: Date;
}): RoomYear {
  const { unit, leases, from, to } = args;

  const periodDays = Math.max(1, differenceInCalendarDays(to, from) + 1);

  // Days covered by any tenancy, counted once even where two leases overlap at
  // a changeover.
  const covered = new Set<number>();
  for (const lease of leases) {
    const start = new Date(`${lease.start_date}T00:00:00`);
    const end = lease.end_date ? new Date(`${lease.end_date}T00:00:00`) : to;

    const first = Math.max(0, differenceInCalendarDays(start, from));
    const last = Math.min(periodDays - 1, differenceInCalendarDays(end, from));

    for (let d = first; d <= last; d++) covered.add(d);
  }

  const emptyDays = periodDays - covered.size;

  // At the asking rate, not at what the last tenant paid: what an empty room
  // costs is what it would be earning now.
  const dailyRate = unit.monthly_rate_cents / 30.44;

  return {
    unit,
    receivedCents: args.receivedCents,
    spentCents: args.spentCents,
    netCents: args.receivedCents - args.spentCents,
    emptyDays,
    vacancyCents: Math.round(emptyDays * dailyRate),
    occupant: args.occupantName,
  };
}

/** The whole building, for the line at the bottom of the table. */
export function roomTotals(rooms: RoomYear[]) {
  return {
    receivedCents: rooms.reduce((t, r) => t + r.receivedCents, 0),
    spentCents: rooms.reduce((t, r) => t + r.spentCents, 0),
    netCents: rooms.reduce((t, r) => t + r.netCents, 0),
    emptyDays: rooms.reduce((t, r) => t + r.emptyDays, 0),
    vacancyCents: rooms.reduce((t, r) => t + r.vacancyCents, 0),
  };
}
