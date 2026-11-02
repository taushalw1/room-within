/**
 * Turning an audit row into a sentence.
 *
 * A trail nobody can read is a trail nobody reads. Raw column names and cent
 * amounts are accurate and useless; the point of this file is that a line
 * says "rent changed from $650.00 to $700.00 — Suite 2" rather than
 * `{"rent_cents":{"from":65000,"to":70000}}`.
 */

export type AuditRow = {
  id: number;
  at: string;
  actor: string | null;
  actor_email: string | null;
  table_name: string;
  row_id: string | null;
  action: "insert" | "update" | "delete";
  changes: Record<string, unknown>;
};

/** What each table is called in English, singular. */
const TABLES: Record<string, string> = {
  leases: "tenancy",
  invoices: "invoice",
  payments: "payment",
  expenses: "cost",
  deposit_entries: "deposit movement",
  move_outs: "move-out",
  move_out_items: "clean-out line",
  units: "room",
  contacts: "person",
  settings: "setting",
  waiting_list: "waiting list entry",
  contractors: "contractor",
  recurring_tasks: "recurring job",
  warranties: "warranty",
  late_fee_log: "late fee",
  memberships: "membership",
};

/** Columns worth naming. Anything not here is shown as-is. */
const FIELDS: Record<string, string> = {
  rent_cents: "rent",
  deposit_cents: "deposit",
  amount_cents: "amount",
  tax_cents: "tax",
  cost_cents: "cost",
  charge_cents: "charge",
  balance_cents: "balance",
  monthly_rate_cents: "asking rent",
  budget_cents: "budget",
  monthly_price_cents: "monthly price",
  due_day: "due day",
  start_date: "start date",
  end_date: "end date",
  leaving_on: "leaving on",
  due_date: "due date",
  incurred_on: "date",
  occurred_on: "date",
  next_due_on: "next due",
  last_done_on: "last done",
  expires_on: "cover runs out",
  full_name: "name",
  status: "status",
  category: "category",
  description: "what for",
  keys_issued: "keys handed over",
  emergency_name: "emergency contact",
  emergency_phone: "emergency phone",
  is_active: "active",
  done_by_tenant: "ticked by tenant",
  checked_by_admin: "checked at walk-through",
};

/** Columns never worth a line of their own. */
const DULL = new Set(["updated_at", "created_at", "id"]);

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "nothing";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (field.endsWith("_cents") && typeof value === "number") return money(value);
  if (typeof value === "object") return JSON.stringify(value);

  const text = String(value);
  // Long free text in a trail is noise; the fact that it changed is the point.
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

export function tableLabel(name: string): string {
  return TABLES[name] ?? name.replace(/_/g, " ");
}

function fieldLabel(name: string): string {
  return FIELDS[name] ?? name.replace(/_/g, " ");
}

/**
 * The change as a list of phrases.
 *
 * An insert or delete lists what the row was; an update lists only what moved,
 * which is the whole reason the trigger stores a diff rather than two copies.
 */
export function describe(row: AuditRow): string[] {
  const entries = Object.entries(row.changes).filter(([k]) => !DULL.has(k));

  if (row.action === "update") {
    return entries
      .filter(([, v]) => v && typeof v === "object" && "from" in (v as object))
      .map(([field, v]) => {
        const { from, to } = v as { from: unknown; to: unknown };
        const label = fieldLabel(field);
        const empty = (x: unknown) => x === null || x === undefined || x === "";

        // "charge set to $60.00" rather than "charge: nothing → $60.00".
        // Most changes to an empty field are a first entry, not a comparison.
        if (empty(from) && !empty(to)) return `${label} set to ${show(field, to)}`;
        if (!empty(from) && empty(to)) {
          return `${label} cleared (was ${show(field, from)})`;
        }
        return `${label}: ${show(field, from)} → ${show(field, to)}`;
      });
  }

  // Created or removed: the handful of fields that say what it was.
  const interesting = entries
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .slice(0, 5);

  return interesting.map(([field, v]) => `${fieldLabel(field)}: ${show(field, v)}`);
}

/** Who did it, in words. */
export function actorLabel(row: AuditRow): string {
  // No signed-in user means the server's own key — a nightly run, a webhook, a
  // scheduled job. Saying "the app" is more honest than leaving it blank.
  return row.actor_email ?? "the app, on its own";
}

export function headline(row: AuditRow): string {
  const what = tableLabel(row.table_name);
  const a = /^[aeiou]/i.test(what) ? "an" : "a";

  if (row.action === "insert") return `Added ${a} ${what}`;
  if (row.action === "delete") return `Removed ${a} ${what}`;
  return `Changed ${a} ${what}`;
}
