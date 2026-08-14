import { addDays, format, startOfMonth, subDays, subMonths } from "date-fns";
import type {
  AppointmentRow,
  BookingRow,
  ContactRow,
  CounsellingRequestRow,
  ExpenseRow,
  InvoiceRow,
  LeaseRow,
  TaskRow,
  UnitRow,
} from "./types";

/**
 * Sample admin data for demo mode (no database connected).
 * Dates are generated relative to today so overdue invoices really are overdue
 * and the dashboard always looks alive.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const iso = (offset: number, hour = 9) => {
  const d = addDays(new Date(), offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const sampleContacts: ContactRow[] = [
  { id: "c1", full_name: "Marla Devereux", email: "marla@prairielegal.ca", phone: "403-555-0142", organisation: "Prairie Legal Services", tags: ["tenant"], address: null, notes: "Upstairs office. Prefers email.", created_at: iso(-420) },
  { id: "c2", full_name: "Joel Ferrand", email: "joel.ferrand@example.com", phone: "403-555-0198", organisation: "Ferrand Bookkeeping", tags: ["tenant"], address: null, notes: null, created_at: iso(-300) },
  { id: "c3", full_name: "Priya Raghunathan", email: "priya.r@example.com", phone: "403-555-0177", organisation: null, tags: ["tenant", "counselling"], address: null, notes: "Suite 2.", created_at: iso(-210) },
  { id: "c4", full_name: "Grassy Lake Homeschool Co-op", email: "coop@example.com", phone: null, organisation: "Homeschool Co-op", tags: ["booking"], address: null, notes: "Books the Gathering Room most Tuesdays.", created_at: iso(-160) },
  { id: "c5", full_name: "Dorothy Kilbride", email: "dot.kilbride@example.com", phone: "403-555-0113", organisation: null, tags: ["booking", "donor"], address: null, notes: null, created_at: iso(-90) },
  { id: "c6", full_name: "Sam Oyelaran", email: "sam.oyelaran@example.com", phone: "403-555-0166", organisation: null, tags: ["counselling"], address: null, notes: null, created_at: iso(-45) },
];

export const sampleUnits: UnitRow[] = [
  { id: "u1", name: "Office 1 — Front", kind: "office", floor: "Main", description: "Street-facing office with the big window.", monthly_rate_cents: 65000, is_active: true, sort_order: 1 },
  { id: "u2", name: "Office 2 — Rear", kind: "office", floor: "Main", description: "Quieter back office.", monthly_rate_cents: 55000, is_active: true, sort_order: 2 },
  { id: "u3", name: "Suite 1", kind: "suite", floor: "Upper", description: "One-bedroom residential suite.", monthly_rate_cents: 95000, is_active: true, sort_order: 3 },
  { id: "u4", name: "Suite 2", kind: "suite", floor: "Upper", description: "Studio suite with the outside stair.", monthly_rate_cents: 85000, is_active: true, sort_order: 4 },
];

export const sampleLeases: LeaseRow[] = [
  { id: "l1", unit_id: "u1", contact_id: "c1", start_date: day(-400), end_date: null, rent_cents: 65000, deposit_cents: 65000, due_day: 1, status: "active", notes: null },
  { id: "l2", unit_id: "u2", contact_id: "c2", start_date: day(-280), end_date: null, rent_cents: 55000, deposit_cents: 55000, due_day: 1, status: "active", notes: null },
  { id: "l3", unit_id: "u4", contact_id: "c3", start_date: day(-190), end_date: null, rent_cents: 85000, deposit_cents: 85000, due_day: 1, status: "active", notes: "Rent reviewed each January." },
];

/** Helper that fills in the computed columns the `invoice_balances` view adds. */
function inv(
  base: Omit<InvoiceRow, "paid_cents" | "balance_cents" | "state" | "days_overdue">,
  paidCents: number,
): InvoiceRow {
  const total = base.amount_cents + base.tax_cents;
  const balance = total - paidCents;
  const daysOverdue = Math.floor(
    (Date.now() - new Date(base.due_date).getTime()) / 86_400_000,
  );
  const state: InvoiceRow["state"] =
    base.status === "void"
      ? "void"
      : base.status === "draft"
        ? "draft"
        : balance <= 0
          ? "paid"
          : daysOverdue > 0
            ? "overdue"
            : "outstanding";
  return { ...base, paid_cents: paidCents, balance_cents: balance, state, days_overdue: daysOverdue };
}

export const sampleInvoices: InvoiceRow[] = [
  inv({ id: "i1", number: "RW-000041", contact_id: "c1", lease_id: "l1", booking_id: null, appointment_id: null, kind: "rent", description: "Office 1 — monthly rent", period_start: day(-31), period_end: day(-1), issue_date: day(-34), due_date: day(-31), amount_cents: 65000, tax_cents: 0, status: "sent", notes: null }, 65000),
  inv({ id: "i2", number: "RW-000042", contact_id: "c2", lease_id: "l2", booking_id: null, appointment_id: null, kind: "rent", description: "Office 2 — monthly rent", period_start: day(-31), period_end: day(-1), issue_date: day(-34), due_date: day(-31), amount_cents: 55000, tax_cents: 0, status: "sent", notes: null }, 55000),
  inv({ id: "i3", number: "RW-000043", contact_id: "c3", lease_id: "l3", booking_id: null, appointment_id: null, kind: "rent", description: "Suite 2 — monthly rent", period_start: day(-31), period_end: day(-1), issue_date: day(-34), due_date: day(-9), amount_cents: 85000, tax_cents: 0, status: "sent", notes: null }, 0),
  inv({ id: "i4", number: "RW-000044", contact_id: "c1", lease_id: "l1", booking_id: null, appointment_id: null, kind: "rent", description: "Office 1 — monthly rent", period_start: day(0), period_end: day(29), issue_date: day(-3), due_date: day(2), amount_cents: 65000, tax_cents: 0, status: "sent", notes: null }, 0),
  inv({ id: "i5", number: "RW-000045", contact_id: "c2", lease_id: "l2", booking_id: null, appointment_id: null, kind: "rent", description: "Office 2 — monthly rent", period_start: day(0), period_end: day(29), issue_date: day(-3), due_date: day(2), amount_cents: 55000, tax_cents: 0, status: "sent", notes: null }, 0),
  inv({ id: "i6", number: "RW-000046", contact_id: "c4", lease_id: null, booking_id: "b1", appointment_id: null, kind: "booking", description: "Gathering Room — 3 hours", period_start: null, period_end: null, issue_date: day(-20), due_date: day(-20), amount_cents: 10500, tax_cents: 525, status: "sent", notes: null }, 11025),
  inv({ id: "i7", number: "RW-000047", contact_id: "c5", lease_id: null, booking_id: "b2", appointment_id: null, kind: "booking", description: "Maker Space — half day", period_start: null, period_end: null, issue_date: day(-16), due_date: day(-16), amount_cents: 9000, tax_cents: 450, status: "sent", notes: null }, 0),
  inv({ id: "i8", number: "RW-000048", contact_id: "c6", lease_id: null, booking_id: null, appointment_id: "a2", kind: "counselling", description: "Counselling session — 1 hour", period_start: null, period_end: null, issue_date: day(-6), due_date: day(1), amount_cents: 14000, tax_cents: 0, status: "sent", notes: null }, 0),
];

export const sampleBookings: BookingRow[] = [
  { id: "b1", room_id: "sample-gathering", contact_id: "c4", booker_name: "Grassy Lake Homeschool Co-op", booker_email: "coop@example.com", booker_phone: null, title: "Homeschool Co-op — Science Morning", purpose: "Weekly co-op session", starts_at: iso(6, 9), ends_at: iso(6, 12), attendees: 22, status: "confirmed", total_cents: 10500, is_paid: true, is_public: true, admin_notes: null, created_at: iso(-20) },
  { id: "b2", room_id: "sample-maker", contact_id: "c5", booker_name: "Dorothy Kilbride", booker_email: "dot.kilbride@example.com", booker_phone: "403-555-0113", title: "Quilting afternoon", purpose: "Quilting group", starts_at: iso(9, 13), ends_at: iso(9, 17), attendees: 9, status: "confirmed", total_cents: 9000, is_paid: false, is_public: false, admin_notes: "Invoice sent, still unpaid.", created_at: iso(-16) },
  { id: "b3", room_id: "sample-quiet", contact_id: null, booker_name: "Nadia Beaulieu", booker_email: "nadia.b@example.com", booker_phone: "403-555-0121", title: "Tutoring session", purpose: "Weekly maths tutoring", starts_at: iso(2, 16), ends_at: iso(2, 18), attendees: 2, status: "pending", total_cents: 4000, is_paid: false, is_public: false, admin_notes: null, created_at: iso(-1) },
  { id: "b4", room_id: "sample-gathering", contact_id: null, booker_name: "Tobias Wren", booker_email: "t.wren@example.com", booker_phone: null, title: "60th birthday tea", purpose: "Family gathering", starts_at: iso(15, 14), ends_at: iso(15, 18), attendees: 35, status: "pending", total_cents: 14000, is_paid: false, is_public: false, admin_notes: null, created_at: iso(0) },
];

export const sampleAppointments: AppointmentRow[] = [
  { id: "a1", contact_id: "c3", client_name: "Priya Raghunathan", starts_at: iso(1, 10), ends_at: iso(1, 11), kind: "session", location: "The Quiet Room", rate_cents: 14000, status: "scheduled", invoice_id: null },
  { id: "a2", contact_id: "c6", client_name: "Sam Oyelaran", starts_at: iso(-6, 14), ends_at: iso(-6, 15), kind: "intake", location: "The Quiet Room", rate_cents: 14000, status: "completed", invoice_id: "i8" },
  { id: "a3", contact_id: "c6", client_name: "Sam Oyelaran", starts_at: iso(3, 14), ends_at: iso(3, 15), kind: "session", location: "The Quiet Room", rate_cents: 14000, status: "scheduled", invoice_id: null },
  { id: "a4", contact_id: null, client_name: "R. Halloway", starts_at: iso(4, 11), ends_at: iso(4, 12), kind: "consult", location: "Telephone", rate_cents: 0, status: "scheduled", invoice_id: null },
];

export const sampleTasks: TaskRow[] = [
  { id: "t1", title: "Follow up with Priya about last month's rent", notes: "Second reminder went out automatically. Try a phone call.", due_date: day(0), status: "open", area: "rentals", contact_id: "c3", created_at: iso(-4) },
  { id: "t2", title: "Confirm the birthday tea booking", notes: "Check the room is free for setup the evening before.", due_date: day(1), status: "open", area: "bookings", contact_id: null, created_at: iso(0) },
  { id: "t3", title: "Write intake summary for new client", notes: null, due_date: day(2), status: "doing", area: "counselling", contact_id: "c6", created_at: iso(-2) },
  { id: "t4", title: "Get quote for the roof flashing", notes: "Two quotes minimum before the grant application.", due_date: day(9), status: "open", area: "finance", contact_id: null, created_at: iso(-8) },
  { id: "t5", title: "Order more coffee for Thursday group", notes: null, due_date: day(-2), status: "done", area: "general", contact_id: null, created_at: iso(-12) },
];

export const sampleExpenses: ExpenseRow[] = [
  { id: "x1", incurred_on: day(-4), vendor: "Taber Building Supply", category: "Repairs", description: "Weatherstripping and door hardware", amount_cents: 24350, tax_cents: 1218, payment_method: "Debit", receipt_url: null, notes: null },
  { id: "x2", incurred_on: day(-9), vendor: "Town of Grassy Lake", category: "Utilities", description: "Water and waste", amount_cents: 18600, tax_cents: 0, payment_method: "Pre-authorised", receipt_url: null, notes: null },
  { id: "x3", incurred_on: day(-12), vendor: "ATCO", category: "Utilities", description: "Gas and electricity", amount_cents: 41200, tax_cents: 2060, payment_method: "Pre-authorised", receipt_url: null, notes: null },
  { id: "x4", incurred_on: day(-18), vendor: "Prairie Insurance Brokers", category: "Insurance", description: "Building policy — monthly", amount_cents: 32800, tax_cents: 0, payment_method: "Pre-authorised", receipt_url: null, notes: null },
  { id: "x5", incurred_on: day(-25), vendor: "Lethbridge Janitorial", category: "Cleaning", description: "Monthly common-area clean", amount_cents: 15000, tax_cents: 750, payment_method: "e-Transfer", receipt_url: null, notes: null },
  { id: "x6", incurred_on: day(-33), vendor: "Taber Building Supply", category: "Repairs", description: "Paint and supplies for Office 2", amount_cents: 51400, tax_cents: 2570, payment_method: "Debit", receipt_url: null, notes: null },
  { id: "x7", incurred_on: day(-40), vendor: "Bow Valley Sign Co.", category: "Marketing", description: "Exterior sign refresh", amount_cents: 68000, tax_cents: 3400, payment_method: "Cheque", receipt_url: null, notes: null },
];

export const sampleRequests: CounsellingRequestRow[] = [
  { id: "r1", full_name: "Helena Ostrowski", email: "h.ostrowski@example.com", phone: "403-555-0155", message: "Looking for someone to talk to about a recent bereavement. Weekday mornings work best.", preferred_times: "Weekday mornings", status: "new", created_at: iso(0) },
  { id: "r2", full_name: "Declan Moher", email: "d.moher@example.com", phone: null, message: "Enquiring about availability and rates.", preferred_times: "Evenings", status: "contacted", created_at: iso(-5) },
];

/** Twelve months of income and expense totals, for the finance chart. */
export function sampleMonthlyTotals() {
  const months: { month: string; income: number; expenses: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(new Date(), i));
    // A gentle upward trend with some month-to-month variation.
    const base = 165000 + (11 - i) * 9000;
    const wobble = ((i * 7919) % 41) * 1200 - 24000;
    months.push({
      month: format(m, "MMM"),
      income: base + wobble,
      expenses: 96000 + (((i * 5417) % 29) * 1400),
    });
  }
  return months;
}

export const sampleDonationTotalCents = 4_285_000;
export const sampleRecentPaymentDate = subDays(new Date(), 2).toISOString();
