import { addDays, format } from "date-fns";
import { MOVE_OUT_CHECKLIST } from "@/lib/signing";
import type { DepositEntryRow, MoveOutItemRow, MoveOutRow } from "./types";

/** A tenancy part-way through ending, for demo mode. */

const day = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");
const iso = (n: number) => addDays(new Date(), n).toISOString();

export const sampleMoveOuts: MoveOutRow[] = [
  {
    id: "mo-1",
    lease_id: "l2",
    unit_id: "u2",
    contact_id: "c2",
    leaving_on: day(18),
    forwarding_address: null,
    forwarding_email: null,
    status: "open",
    inspected_on: null,
    inspection_notes: null,
    tenant_signature_event: null,
    created_at: iso(-3),
    updated_at: iso(-3),
  },
];

export const sampleMoveOutItems: MoveOutItemRow[] = MOVE_OUT_CHECKLIST.map(
  (item, index) => ({
    id: `moi-${index + 1}`,
    move_out_id: "mo-1",
    position: index + 1,
    area: item.area,
    title: item.title,
    detail: item.detail || null,
    // A few ticked already, so the demo doesn't look untouched.
    done_by_tenant: index < 3,
    tenant_note: null,
    checked_by_admin: null,
    admin_note: null,
    charge_cents: null,
    photo_path: null,
    created_at: iso(-3),
  }),
);

export const sampleDepositEntries: DepositEntryRow[] = [
  {
    id: "de-1",
    lease_id: "l2",
    move_out_id: null,
    amount_cents: 55000,
    kind: "held",
    reason: "Deposit taken at the start of the tenancy",
    occurred_on: day(-280),
    evidence_path: null,
    created_at: iso(-280),
  },
];
