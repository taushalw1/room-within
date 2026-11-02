import { addDays, format } from "date-fns";
import type { WaitingListRow } from "./types";

/** A couple of people waiting, for demo mode. */

const day = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");
const iso = (n: number) => addDays(new Date(), n).toISOString();

export const sampleWaitingList: WaitingListRow[] = [
  {
    id: "wl-1",
    full_name: "Hannah Beaulieu",
    email: "hannah.b@example.com",
    phone: "403-555-0163",
    looking_for: "A small office for a one-person bookkeeping practice. Quiet matters more than size.",
    unit_kinds: ["office"],
    budget_cents: 60000,
    needed_from: day(45),
    notes: "Rang in October. Keen on the front office if it ever comes up.",
    status: "waiting",
    last_contacted_on: day(-14),
    created_at: iso(-30),
    updated_at: iso(-14),
  },
  {
    id: "wl-2",
    full_name: "Owen Mackay",
    email: null,
    phone: "403-555-0171",
    looking_for: "A studio to live in. Moving back to be nearer family.",
    unit_kinds: ["suite"],
    budget_cents: 90000,
    needed_from: null,
    notes: "No email — phone only.",
    status: "waiting",
    last_contacted_on: null,
    created_at: iso(-8),
    updated_at: iso(-8),
  },
];
