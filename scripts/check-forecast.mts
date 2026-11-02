/**
 * Checks the forecast arithmetic against cases with a known answer.
 *
 *   npm run check:forecast
 *
 * The two that matter: a tenancy that ends must stop paying rent, and a
 * one-off cost must never become a monthly expectation.
 */
import { addMonths, format } from "date-fns";
import { buildForecast, regularCosts } from "../src/lib/forecast";

const now = new Date("2026-11-02T00:00:00");
const month = (n: number) => format(addMonths(now, n), "yyyy-MM");
const day = (n: number) => `${month(n)}-15`;

let bad = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) bad++;
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/* --- Regular costs -------------------------------------------------------- */

const expenses = [
  // Insurance every month: regular.
  ...[-1, -2, -3, -4, -5, -6].map((n) => ({
    category: "Insurance",
    amount_cents: 32800,
    tax_cents: 0,
    incurred_on: day(n),
  })),
  // One new roof: must not become a monthly expectation.
  { category: "Repairs", amount_cents: 1_450_000, tax_cents: 0, incurred_on: day(-2) },
  // Utilities in four of six months, varying: regular, at the median.
  { category: "Utilities", amount_cents: 41200, tax_cents: 0, incurred_on: day(-1) },
  { category: "Utilities", amount_cents: 38000, tax_cents: 0, incurred_on: day(-2) },
  { category: "Utilities", amount_cents: 52000, tax_cents: 0, incurred_on: day(-3) },
  { category: "Utilities", amount_cents: 30000, tax_cents: 0, incurred_on: day(-5) },
];

const regular = regularCosts(expenses, now);
const names = regular.map((r) => r.category);

check("insurance counts as regular", names.includes("Insurance"));
check("a one-off roof does not", !names.includes("Repairs"), `got ${names.join(", ")}`);
check("utilities count at the median", regular.find((r) => r.category === "Utilities")?.cents === 39600,
  `got ${regular.find((r) => r.category === "Utilities")?.cents}`);

/* --- A tenancy that ends -------------------------------------------------- */

const forecast = buildForecast({
  startingCents: 500_00,
  leases: [
    { rent_cents: 65000, start_date: "2025-01-01", end_date: null },
    // Ends after next month.
    { rent_cents: 55000, start_date: "2025-01-01", end_date: `${month(1)}-30` },
  ],
  openInvoices: [],
  memberships: [],
  expenses,
  months: 4,
  now,
});

check("this month's rent isn't double counted", forecast.months[0].rentCents === 0);
check("both tenancies pay next month", forecast.months[1].rentCents === 120000,
  `got ${forecast.months[1].rentCents}`);
check("the ended tenancy stops paying", forecast.months[2].rentCents === 65000,
  `got ${forecast.months[2].rentCents}`);

/* --- Overdue money lands in the current month ----------------------------- */

const withOverdue = buildForecast({
  startingCents: 0,
  leases: [],
  openInvoices: [
    { due_date: "2026-08-01", balance_cents: 90000 },
    { due_date: `${month(2)}-01`, balance_cents: 10000 },
  ],
  memberships: [],
  expenses: [],
  months: 4,
  now,
});

check("overdue money shows this month", withOverdue.months[0].invoicedCents === 90000,
  `got ${withOverdue.months[0].invoicedCents}`);
check("a future invoice shows in its own month", withOverdue.months[2].invoicedCents === 10000);

/* --- The shortfall warning ------------------------------------------------ */

const sinking = buildForecast({
  startingCents: 50000,
  leases: [],
  openInvoices: [],
  memberships: [],
  expenses,
  months: 4,
  now,
});

check("a shortfall is found", sinking.shortfall !== null, sinking.shortfall?.label ?? "none");
check(
  "the balance runs down month by month",
  sinking.months[1].balanceCents < sinking.months[0].balanceCents,
);

console.log(bad === 0 ? "\n  The forecast adds up.\n" : "\n  SOMETHING IS WRONG.\n");
if (bad > 0) process.exit(1);
