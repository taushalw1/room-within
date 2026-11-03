import type {
  BankRuleRow,
  BillRow,
  RecurringCostRow,
  TripRow,
} from "./types";

/**
 * Sample bills, rules, repeating costs and trips.
 *
 * Chosen so each list shows its awkward case rather than its easy one: a bill
 * already overdue, a rule for money coming in as well as going out, a cost
 * dated the 31st so the month-end behaviour is visible, and a trip.
 */

const stamp = {
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
};

export const sampleBankRules: BankRuleRow[] = [
  {
    id: "r1000000-0000-4000-8000-000000000001",
    match_text: "FORTIS ALBERTA",
    direction: "out",
    category: "Utilities",
    vendor: "Fortis Alberta",
    times_used: 11,
    ...stamp,
  },
  {
    id: "r1000000-0000-4000-8000-000000000002",
    match_text: "TOWN OF GRASSY LAKE",
    direction: "out",
    category: "Utilities",
    vendor: "Town of Grassy Lake",
    times_used: 6,
    ...stamp,
  },
  {
    id: "r1000000-0000-4000-8000-000000000003",
    match_text: "MONTHLY ACCOUNT FEE",
    direction: "out",
    category: "Bank charges",
    vendor: null,
    times_used: 2,
    ...stamp,
  },
  // A rule for money arriving, to show the direction is respected.
  {
    id: "r1000000-0000-4000-8000-000000000004",
    match_text: "STRIPE PAYOUT",
    direction: "in",
    category: null,
    vendor: "Stripe",
    times_used: 0,
    ...stamp,
  },
];

export const sampleBills: BillRow[] = [
  {
    id: "b2000000-0000-4000-8000-000000000001",
    vendor: "Hildebrand Roofing",
    description: "Flashing above the north stairwell",
    category: "Repairs",
    amount_cents: 186_000,
    tax_cents: 9_300,
    issued_on: "2026-10-28",
    // Already late, which is the state that needs to be visible.
    due_on: "2026-10-30",
    status: "open",
    expense_id: null,
    unit_id: null,
    notes: null,
    ...stamp,
  },
  {
    id: "b2000000-0000-4000-8000-000000000002",
    vendor: "Prairie Mutual Insurance",
    description: "Building policy, annual",
    category: "Insurance",
    amount_cents: 412_000,
    tax_cents: 0,
    issued_on: "2026-11-01",
    due_on: "2026-12-01",
    status: "open",
    expense_id: null,
    unit_id: null,
    notes: "Ask about the alarm discount before paying.",
    ...stamp,
  },
  {
    id: "b2000000-0000-4000-8000-000000000003",
    vendor: "Lethbridge Janitorial",
    description: "October common-area clean",
    category: "Cleaning",
    amount_cents: 15_000,
    tax_cents: 750,
    issued_on: "2026-10-01",
    due_on: "2026-10-15",
    status: "paid",
    expense_id: "exp-cleaning-oct",
    unit_id: null,
    notes: null,
    ...stamp,
  },
];

export const sampleRecurringCosts: RecurringCostRow[] = [
  {
    id: "c2000000-0000-4000-8000-000000000001",
    vendor: "Fortis Alberta",
    category: "Utilities",
    amount_cents: 18_240,
    cadence: "monthly",
    next_due: "2026-12-14",
    is_active: true,
    notes: null,
    ...stamp,
  },
  {
    id: "c2000000-0000-4000-8000-000000000002",
    vendor: "Prairie Mutual Insurance",
    category: "Insurance",
    amount_cents: 412_000,
    cadence: "yearly",
    next_due: "2027-12-01",
    is_active: true,
    notes: null,
    ...stamp,
  },
  {
    // Dated the 31st on purpose: this is the one whose date has to come back
    // to the 31st after February rather than staying on the 28th.
    id: "c2000000-0000-4000-8000-000000000003",
    vendor: "Town of Grassy Lake",
    category: "Utilities",
    amount_cents: 9_650,
    cadence: "quarterly",
    next_due: "2026-12-31",
    is_active: true,
    notes: "Water and waste.",
    ...stamp,
  },
];

export const sampleTrips: TripRow[] = [
  {
    id: "t2000000-0000-4000-8000-000000000001",
    travelled_on: "2026-11-02",
    purpose: "Paint and fixings for the stairwell",
    from_place: "Grassy Lake",
    to_place: "Lethbridge",
    kilometres: 182.0,
    rate_cents_per_km: 70,
    amount_cents: 12_740,
    notes: null,
    created_at: "2026-11-02T18:00:00Z",
  },
  {
    id: "t2000000-0000-4000-8000-000000000002",
    travelled_on: "2026-10-19",
    purpose: "Bank, and the insurance broker",
    from_place: "Grassy Lake",
    to_place: "Taber",
    kilometres: 64.0,
    rate_cents_per_km: 70,
    amount_cents: 4_480,
    notes: null,
    created_at: "2026-10-19T16:00:00Z",
  },
];
