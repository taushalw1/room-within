import { addDays, format, startOfMonth, subDays } from "date-fns";
import type {
  ClassRow,
  ClassSessionRow,
  CreditLedgerRow,
  EnrolmentRow,
  EquipmentRow,
  InstructorRow,
  InstructorStatementRow,
  MembershipRow,
  StorageRentalRow,
} from "./types";

/**
 * Sample classes, instructors and memberships for demo mode.
 *
 * The arts club is the worked example from the plan — five full, three
 * reduced, two subsidized — so the payout figures on screen match the ones
 * that were reasoned through on paper.
 */

const iso = (days: number, hour = 18) => {
  const d = addDays(new Date(), days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

export const sampleInstructors: InstructorRow[] = [
  {
    id: "ins-1",
    contact_id: "c5",
    display_name: "Dorothy Kilbride",
    headline: "Painting and mixed media",
    bio: "Taught art at the school for twenty-two years. Runs the arts club on Thursday evenings and swears the light in the maker space is the best in town.",
    photo_url: null,
    standing: "earned",
    earned_at: subDays(new Date(), 60).toISOString(),
    guaranteed_pay_cents: 0,
    split_percent: null,
    agreement_signed_on: day(-180),
    waiver_signed_on: day(-180),
    notes: null,
    is_active: true,
    created_at: subDays(new Date(), 200).toISOString(),
  },
  {
    id: "ins-2",
    contact_id: "c6",
    display_name: "Sam Oyelaran",
    headline: "Woodwork and repair",
    bio: "Cabinet maker by trade. Brings his own tools and fixes half the town's chairs on the side.",
    photo_url: null,
    standing: "new",
    earned_at: null,
    guaranteed_pay_cents: 0,
    split_percent: null,
    agreement_signed_on: day(-40),
    waiver_signed_on: day(-40),
    notes: "Three classes in so far. Keen.",
    is_active: true,
    created_at: subDays(new Date(), 45).toISOString(),
  },
];

export const sampleEquipment: EquipmentRow[] = [
  {
    id: "eq-1",
    name: "Pottery wheel",
    description: "Electric, with splash pan.",
    quantity: 2,
    session_rate_cents: 1000,
    is_active: true,
    created_at: subDays(new Date(), 120).toISOString(),
  },
  {
    id: "eq-2",
    name: "Sewing machine",
    description: "Domestic, serviced last spring.",
    quantity: 4,
    session_rate_cents: 500,
    is_active: true,
    created_at: subDays(new Date(), 120).toISOString(),
  },
  {
    id: "eq-3",
    name: "Easel",
    description: "Wooden, adjustable.",
    quantity: 8,
    session_rate_cents: 200,
    is_active: true,
    created_at: subDays(new Date(), 90).toISOString(),
  },
];

export const sampleStorageRentals: StorageRentalRow[] = [
  {
    id: "st-1",
    instructor_id: "ins-1",
    label: "Shelf 3, maker space",
    size: "shelf",
    monthly_rate_cents: 4000,
    started_on: day(-150),
    ended_on: null,
    notes: "Greenware and glazes.",
    created_at: subDays(new Date(), 150).toISOString(),
  },
  {
    id: "st-2",
    instructor_id: "ins-2",
    label: "Corner by the back door",
    size: "corner",
    monthly_rate_cents: 7500,
    started_on: day(-30),
    ended_on: null,
    notes: "Timber rack.",
    created_at: subDays(new Date(), 30).toISOString(),
  },
];

export const sampleClasses: ClassRow[] = [
  {
    id: "cls-1",
    instructor_id: "ins-1",
    room_id: "sample-maker",
    title: "Grassy Lake Arts Club",
    summary: "Painting and mixed media, Thursday evenings.",
    description:
      "An easy evening with a brush in your hand. Bring nothing but yourself — everything is set out ready. Suits complete beginners as happily as it suits people who painted years ago and stopped.",
    session_minutes: 90,
    capacity: 10,
    full_price_cents: 2000,
    reduced_price_cents: 1200,
    subsidized_price_cents: 500,
    subsidized_seat_cap: 3,
    credit_cost: 1,
    materials_cost_cents: 500,
    materials_note: "Acrylic paint, canvas, brushes.",
    min_headcount: 3,
    status: "open",
    is_public: true,
    created_at: subDays(new Date(), 90).toISOString(),
  },
  {
    id: "cls-2",
    instructor_id: "ins-2",
    room_id: "sample-maker",
    title: "Fix It Night",
    summary: "Bring something broken. Leave with it mended.",
    description:
      "A chair that wobbles, a drawer that sticks, a lamp that flickers. Sam will show you how to mend it rather than mend it for you, which is slower and much more useful.",
    session_minutes: 120,
    capacity: 8,
    full_price_cents: 2500,
    reduced_price_cents: 1500,
    subsidized_price_cents: 700,
    subsidized_seat_cap: 2,
    credit_cost: 2,
    materials_cost_cents: 0,
    materials_note: null,
    min_headcount: 3,
    status: "open",
    is_public: true,
    created_at: subDays(new Date(), 40).toISOString(),
  },
];

export const sampleClassSessions: ClassSessionRow[] = [
  // Delivered, earlier this month — these are what the statement is built from.
  {
    id: "ses-1",
    class_id: "cls-1",
    starts_at: iso(-21),
    ends_at: iso(-21, 19),
    status: "delivered",
    decided_at: iso(-22),
    cancel_reason: null,
    attendance_recorded_at: iso(-21, 20),
    notes: null,
    created_at: subDays(new Date(), 60).toISOString(),
  },
  {
    id: "ses-2",
    class_id: "cls-1",
    starts_at: iso(-14),
    ends_at: iso(-14, 19),
    status: "delivered",
    decided_at: iso(-15),
    cancel_reason: null,
    attendance_recorded_at: iso(-14, 20),
    notes: null,
    created_at: subDays(new Date(), 60).toISOString(),
  },
  {
    id: "ses-3",
    class_id: "cls-1",
    starts_at: iso(-7),
    ends_at: iso(-7, 19),
    status: "delivered",
    decided_at: iso(-8),
    cancel_reason: null,
    attendance_recorded_at: iso(-7, 20),
    notes: null,
    created_at: subDays(new Date(), 60).toISOString(),
  },
  // Confirmed and coming up.
  {
    id: "ses-4",
    class_id: "cls-1",
    starts_at: iso(2),
    ends_at: iso(2, 19),
    status: "confirmed",
    decided_at: iso(-1),
    cancel_reason: null,
    attendance_recorded_at: null,
    notes: null,
    created_at: subDays(new Date(), 30).toISOString(),
  },
  // Still short of its minimum — the one that shows the rule at work.
  {
    id: "ses-5",
    class_id: "cls-2",
    starts_at: iso(4, 19),
    ends_at: iso(4, 21),
    status: "scheduled",
    decided_at: null,
    cancel_reason: null,
    attendance_recorded_at: null,
    notes: null,
    created_at: subDays(new Date(), 20).toISOString(),
  },
  {
    id: "ses-6",
    class_id: "cls-1",
    starts_at: iso(9),
    ends_at: iso(9, 19),
    status: "scheduled",
    decided_at: null,
    cancel_reason: null,
    attendance_recorded_at: null,
    notes: null,
    created_at: subDays(new Date(), 20).toISOString(),
  },
];

/** Five full, three reduced, two subsidized — the worked example. */
function artsClubSeats(sessionId: string, offset: number): EnrolmentRow[] {
  const names = [
    "Ellen Prowse",
    "Ruth Vandenberg",
    "Iris McCallum",
    "Tom Bezuidenhout",
    "Nadia Kovalenko",
    "Bernice Hollingsworth",
    "Wes Tanaka",
    "Colleen Fairweather",
    "Hana Osei",
    "Doug Pritchard",
  ];
  const tiers: EnrolmentRow["tier"][] = [
    "full",
    "full",
    "full",
    "full",
    "full",
    "reduced",
    "reduced",
    "reduced",
    "subsidized",
    "subsidized",
  ];
  const price = { full: 2000, reduced: 1200, subsidized: 500 };

  return names.map((name, i) => ({
    id: `enr-${sessionId}-${i}`,
    session_id: sessionId,
    contact_id: null,
    attendee_name: name,
    attendee_email: null,
    tier: tiers[i],
    method: i < 3 ? "credit" : "cash",
    credits_spent: i < 3 ? 1 : 0,
    paid_cents: i < 3 ? 0 : price[tiers[i]],
    subsidy_cents: i < 3 ? 2000 : 2000 - price[tiers[i]],
    attended: true,
    cancelled_at: null,
    created_at: subDays(new Date(), 30 + offset).toISOString(),
  }));
}

export const sampleEnrolments: EnrolmentRow[] = [
  ...artsClubSeats("ses-1", 0),
  ...artsClubSeats("ses-2", 1),
  ...artsClubSeats("ses-3", 2),
  ...artsClubSeats("ses-4", 3).map((e) => ({ ...e, attended: null })),
  // Fix It Night, two signed up and needing three.
  {
    id: "enr-ses-5-0",
    session_id: "ses-5",
    contact_id: null,
    attendee_name: "Priya Raghunathan",
    attendee_email: null,
    tier: "full",
    method: "cash",
    credits_spent: 0,
    paid_cents: 2500,
    subsidy_cents: 0,
    attended: null,
    cancelled_at: null,
    created_at: subDays(new Date(), 5).toISOString(),
  },
  {
    id: "enr-ses-5-1",
    session_id: "ses-5",
    contact_id: null,
    attendee_name: "Joel Ferrand",
    attendee_email: null,
    tier: "reduced",
    method: "cash",
    credits_spent: 0,
    paid_cents: 1500,
    subsidy_cents: 1000,
    attended: null,
    cancelled_at: null,
    created_at: subDays(new Date(), 4).toISOString(),
  },
];

export const sampleMemberships: MembershipRow[] = [
  {
    id: "mem-1",
    contact_id: "c4",
    plan: "family",
    household_name: "The Vandenberg family",
    monthly_price_cents: 7000,
    credits_per_month: 8,
    status: "active",
    started_on: day(-120),
    cancelled_on: null,
    stripe_subscription_id: null,
    notes: null,
    created_at: subDays(new Date(), 120).toISOString(),
  },
  {
    id: "mem-2",
    contact_id: "c5",
    plan: "individual",
    household_name: null,
    monthly_price_cents: 4000,
    credits_per_month: 4,
    status: "active",
    started_on: day(-60),
    cancelled_on: null,
    stripe_subscription_id: null,
    notes: null,
    created_at: subDays(new Date(), 60).toISOString(),
  },
  {
    id: "mem-3",
    contact_id: "c3",
    plan: "individual",
    household_name: null,
    monthly_price_cents: 4000,
    credits_per_month: 4,
    status: "cancelled",
    started_on: day(-200),
    cancelled_on: day(-20),
    stripe_subscription_id: null,
    notes: "Moved to Taber.",
    created_at: subDays(new Date(), 200).toISOString(),
  },
];

const monthStart = startOfMonth(new Date());
const lastMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

const grant = (
  id: string,
  membership_id: string,
  delta: number,
  when: Date,
  expires: Date,
): CreditLedgerRow => ({
  id,
  membership_id,
  delta,
  reason: "monthly",
  session_id: null,
  expires_on: format(expires, "yyyy-MM-dd"),
  period: format(when, "yyyy-MM-01"),
  note: null,
  created_at: when.toISOString(),
});

export const sampleCreditLedger: CreditLedgerRow[] = [
  grant(
    "cl-1",
    "mem-1",
    8,
    lastMonth,
    new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 3, 0),
  ),
  grant(
    "cl-2",
    "mem-1",
    8,
    monthStart,
    new Date(monthStart.getFullYear(), monthStart.getMonth() + 3, 0),
  ),
  {
    id: "cl-3",
    membership_id: "mem-1",
    delta: -3,
    reason: "spent",
    session_id: "ses-2",
    expires_on: null,
    period: null,
    note: "Arts club",
    created_at: subDays(new Date(), 14).toISOString(),
  },
  grant(
    "cl-4",
    "mem-2",
    4,
    monthStart,
    new Date(monthStart.getFullYear(), monthStart.getMonth() + 3, 0),
  ),
  {
    id: "cl-5",
    membership_id: "mem-2",
    delta: -1,
    reason: "spent",
    session_id: "ses-3",
    expires_on: null,
    period: null,
    note: "Arts club",
    created_at: subDays(new Date(), 7).toISOString(),
  },
];

/**
 * A worked month for Dorothy: three arts-club sessions delivered, easels
 * hired, a shelf rented. The figures follow the same arithmetic the real
 * statement builder uses, so demo mode and live mode agree.
 */
export const sampleStatements: InstructorStatementRow[] = [
  {
    id: "stm-1",
    instructor_id: "ins-1",
    period: format(startOfMonth(new Date()), "yyyy-MM-01"),
    class_revenue_cents: 60_000,
    instructor_share_cents: 42_000,
    equipment_cents: 3_600,
    storage_cents: 4_000,
    guaranteed_cents: 0,
    net_payout_cents: 34_400,
    materials_cents: 15_000,
    sessions_delivered: 3,
    status: "draft",
    paid_on: null,
    notes: null,
    created_at: subDays(new Date(), 1).toISOString(),
  },
];
