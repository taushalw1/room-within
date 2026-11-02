import { addMinutes } from "date-fns";
import type { AuditRow } from "@/lib/audit";

/** A plausible afternoon's worth of changes, for demo mode. */

const ago = (minutes: number) => addMinutes(new Date(), -minutes).toISOString();

export const sampleAudit: AuditRow[] = [
  {
    id: 6,
    at: ago(25),
    actor: "demo-admin",
    actor_email: "tausha@roomwithin.ca",
    table_name: "leases",
    row_id: "l3",
    action: "update",
    changes: { rent_cents: { from: 85000, to: 89000 } },
  },
  {
    id: 5,
    at: ago(90),
    actor: null,
    actor_email: null,
    table_name: "invoices",
    row_id: "inv-21",
    action: "insert",
    changes: {
      kind: "rent",
      description: "Rent — November 2026",
      amount_cents: 55000,
      due_date: "2026-11-01",
    },
  },
  {
    id: 4,
    at: ago(220),
    actor: "demo-admin",
    actor_email: "tausha@roomwithin.ca",
    table_name: "expenses",
    row_id: "ex-9",
    action: "insert",
    changes: {
      vendor: "Taber Building Supply",
      category: "Repairs",
      amount_cents: 7634,
      incurred_on: "2026-10-28",
    },
  },
  {
    id: 3,
    at: ago(400),
    actor: "demo-admin",
    actor_email: "tausha@roomwithin.ca",
    table_name: "move_out_items",
    row_id: "moi-3",
    action: "update",
    changes: { checked_by_admin: { from: null, to: false }, charge_cents: { from: null, to: 6000 } },
  },
  {
    id: 2,
    at: ago(1500),
    actor: null,
    actor_email: null,
    table_name: "payments",
    row_id: "pay-14",
    action: "insert",
    changes: { amount_cents: 55000, method: "stripe" },
  },
  {
    id: 1,
    at: ago(2900),
    actor: "demo-admin",
    actor_email: "tausha@roomwithin.ca",
    table_name: "settings",
    row_id: null,
    action: "update",
    changes: { value: { from: { enabled: false }, to: { enabled: true } } },
  },
];
