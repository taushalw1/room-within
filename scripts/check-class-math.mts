/**
 * Checks the class arithmetic against the worked example that was reasoned
 * through on paper: 5 full, 3 reduced, 2 subsidized in the arts club.
 *
 *   npm run check:math
 */
import {
  DEFAULT_CLASS_SETTINGS,
  buildStatement,
  sessionMoney,
  subsidyFor,
} from "../src/lib/classes.ts";
import { DEFAULT_CREDIT_SETTINGS, creditBalance } from "../src/lib/credits.ts";
import type {
  ClassRow,
  ClassSessionRow,
  CreditLedgerRow,
  EnrolmentRow,
  EquipmentRow,
  InstructorRow,
  StorageRentalRow,
} from "../src/lib/data/types.ts";

let failures = 0;
const is = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
};

const klass = {
  id: "c",
  instructor_id: "i",
  room_id: null,
  title: "Arts Club",
  summary: null,
  description: null,
  session_minutes: 90,
  capacity: 10,
  full_price_cents: 2000,
  reduced_price_cents: 1200,
  subsidized_price_cents: 500,
  subsidized_seat_cap: 3,
  credit_cost: 1,
  materials_cost_cents: 500,
  materials_note: null,
  min_headcount: 3,
  status: "open",
  is_public: true,
  created_at: "",
} satisfies ClassRow;

const seat = (
  i: number,
  tier: EnrolmentRow["tier"],
  paid: number,
): EnrolmentRow => ({
  id: `e${i}`,
  session_id: "s1",
  contact_id: null,
  attendee_name: `Person ${i}`,
  attendee_email: null,
  tier,
  method: "cash",
  credits_spent: 0,
  paid_cents: paid,
  subsidy_cents: subsidyFor(klass, tier),
  attended: true,
  cancelled_at: null,
  created_at: "",
});

const enrolments: EnrolmentRow[] = [
  ...Array.from({ length: 5 }, (_, i) => seat(i, "full", 2000)),
  ...Array.from({ length: 3 }, (_, i) => seat(5 + i, "reduced", 1200)),
  ...Array.from({ length: 2 }, (_, i) => seat(8 + i, "subsidized", 500)),
];

const instructor = {
  id: "i",
  contact_id: null,
  display_name: "Dorothy",
  headline: null,
  bio: null,
  photo_url: null,
  standing: "earned",
  earned_at: null,
  guaranteed_pay_cents: 0,
  split_percent: null,
  agreement_signed_on: null,
  waiver_signed_on: null,
  notes: null,
  is_active: true,
  created_at: "",
} satisfies InstructorRow;

const easel = {
  id: "eq",
  name: "Easel",
  description: null,
  quantity: 8,
  session_rate_cents: 200,
  is_active: true,
  created_at: "",
} satisfies EquipmentRow;

console.log("\nOne session — 5 full, 3 reduced, 2 subsidized\n");

const m = sessionMoney(klass, enrolments, {
  settings: DEFAULT_CLASS_SETTINGS,
  instructor,
  equipment: [{ equipment: easel, quantity: 6 }],
});

is("people", m.headcount, 10);
is("cash taken (5x20 + 3x12 + 2x5)", m.collectedCents, 14600);
is("scholarship top-up to full price", m.subsidyCents, 5400);
is("split is calculated on the full price", m.splittableCents, 20000);
is("instructor 70%", m.instructorCents, 14000);
is("hub 30%", m.hubCents, 6000);
is("easel hire, 6 x $2", m.equipmentCents, 1200);
is("materials recorded, 10 x $5", m.materialsCents, 5000);
is("subsidized seats over the cap of 3", m.overSubsidyCap, false);

console.log("\nA month — four sessions, easels, one shelf\n");

const session = (i: number): ClassSessionRow => ({
  id: `s${i}`,
  class_id: "c",
  starts_at: `2026-03-0${i}T18:00:00Z`,
  ends_at: `2026-03-0${i}T19:30:00Z`,
  status: "delivered",
  decided_at: null,
  cancel_reason: null,
  attendance_recorded_at: null,
  notes: null,
  created_at: "",
});

const storage: StorageRentalRow[] = [
  {
    id: "st",
    instructor_id: "i",
    label: "Shelf 3",
    size: "shelf",
    monthly_rate_cents: 4000,
    started_on: "2026-01-01",
    ended_on: null,
    notes: null,
    created_at: "",
  },
];

const statement = buildStatement({
  instructor,
  period: new Date(2026, 2, 1),
  sessions: [1, 2, 3, 4].map((i) => ({ session: session(i), klass, money: m })),
  storage,
});

is("four sessions counted", statement.sessionsDelivered, 4);
is("their share, 4 x $140", statement.instructorShareCents, 56000);
is("equipment, 4 x $12", statement.equipmentCents, 4800);
is("storage, once for the month", statement.storageCents, 4000);
is("net payout", statement.netPayoutCents, 47200);
is("materials recorded, not deducted", statement.materialsCents, 20000);

console.log("\nCredits — oldest spent first, expiry respected\n");

const grantRow = (
  id: string,
  delta: number,
  created: string,
  expires: string | null,
): CreditLedgerRow => ({
  id,
  membership_id: "m",
  delta,
  reason: delta > 0 ? "monthly" : "spent",
  session_id: null,
  expires_on: expires,
  period: null,
  note: null,
  created_at: created,
});

const today = new Date("2026-03-15");
const balance = creditBalance(
  [
    grantRow("g1", 8, "2026-01-01", "2026-02-28"), // expired
    grantRow("g2", 8, "2026-02-01", "2026-03-31"), // expiring this month
    grantRow("g3", 8, "2026-03-01", "2026-04-30"),
    grantRow("s1", -3, "2026-03-02", null),
  ],
  today,
);

is("spend came off the oldest grant first", balance.expired, 5);
is("usable now", balance.available, 16);
is("going at the end of the month", balance.expiringSoon, 8);

console.log(
  failures === 0
    ? "\nAll the class arithmetic checks out.\n"
    : `\n${failures} check${failures === 1 ? "" : "s"} failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
