import { HandHeart, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { AddPanel } from "@/components/admin/AddPanel";
import { ExpenseForm } from "@/components/admin/ExpenseForm";
import { ExpenseRow } from "@/components/admin/ExpenseRow";
import { MonthlyChart } from "@/components/admin/MonthlyChart";
import { Stat } from "@/components/admin/Stat";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import {
  getDonations,
  getExpenses,
  getInstructorStatements,
  getInvoices,
  getMonthlyTotals,
} from "@/lib/data/admin";
import {
  getClassEquipment,
  getClassSessions,
  getClassSettings,
  getClasses,
  getCreditLedger,
  getCreditSettings,
  getEnrolments,
  getInstructors,
  getMemberships,
} from "@/lib/data/classes";
import { sessionMoney } from "@/lib/classes";
import { creditBalance, creditValueCents } from "@/lib/credits";
import { dateShort, money, moneyExact } from "@/lib/format";

const STREAM_LABELS: Record<string, string> = {
  rent: "Rent",
  booking: "Room bookings",
  counselling: "Counselling",
  deposit: "Deposits",
  other: "Other",
};

export default async function FinancePage() {
  const [
    invoices,
    expenses,
    monthly,
    donationList,
    classes,
    sessions,
    enrolments,
    instructors,
    statements,
    memberships,
    ledger,
    classSettings,
    creditSettings,
    classEquipment,
  ] = await Promise.all([
    getInvoices(),
    getExpenses(),
    getMonthlyTotals(),
    getDonations(),
    getClasses(),
    getClassSessions(),
    getEnrolments(),
    getInstructors(),
    getInstructorStatements(),
    getMemberships(),
    getCreditLedger(),
    getClassSettings(),
    getCreditSettings(),
    getClassEquipment(),
  ]);

  const collected = invoices.reduce((s, i) => s + i.paid_cents, 0);
  const owed = invoices
    .filter((i) => i.state === "overdue" || i.state === "outstanding")
    .reduce((s, i) => s + i.balance_cents, 0);
  const spent = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const donations = donationList.reduce((s, d) => s + d.amount_cents, 0);

  /* ---- Classes ---- */

  const instructorById = new Map(instructors.map((i) => [i.id, i]));
  const classById = new Map(classes.map((c) => [c.id, c]));

  const delivered = sessions
    .filter((session) => session.status === "delivered")
    .map((session) => {
      const klass = classById.get(session.class_id);
      if (!klass) return null;
      return {
        session,
        klass,
        money: sessionMoney(
          klass,
          enrolments.filter((e) => e.session_id === session.id),
          {
            settings: classSettings,
            instructor: instructorById.get(klass.instructor_id ?? "") ?? null,
            equipment: classEquipment.get(klass.id),
          },
        ),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const classFees = delivered.reduce((s, d) => s + d.money.collectedCents, 0);
  const hubShare = delivered.reduce((s, d) => s + d.money.hubCents, 0);
  const instructorShare = delivered.reduce(
    (s, d) => s + d.money.instructorCents,
    0,
  );
  const equipmentIncome = delivered.reduce(
    (s, d) => s + d.money.equipmentCents,
    0,
  );
  const subsidyGiven = delivered.reduce((s, d) => s + d.money.subsidyCents, 0);
  const seatsTaught = delivered.reduce((s, d) => s + d.money.headcount, 0);

  const owedToInstructors = statements
    .filter((x) => x.status !== "paid")
    .reduce((s, x) => s + x.net_payout_cents, 0);

  /* ---- Credits: money taken for classes not yet taught ---- */

  const creditLiability = memberships.reduce((sum, m) => {
    const balance = creditBalance(
      ledger.filter((r) => r.membership_id === m.id),
    );
    return sum + balance.available * creditValueCents(m.plan, creditSettings);
  }, 0);

  /* ---- Year end ---- */

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  // Anyone paid more than $500 in a calendar year needs a T4A by February.
  const t4a = instructors
    .map((instructor) => {
      const paid = statements
        .filter(
          (x) =>
            x.instructor_id === instructor.id &&
            x.status === "paid" &&
            new Date(x.period) >= yearStart,
        )
        .reduce((sum, x) => sum + x.net_payout_cents, 0);
      return { instructor, paid };
    })
    .filter((x) => x.paid > 0)
    .sort((a, b) => b.paid - a.paid);

  const t4aNeeded = t4a.filter((x) => x.paid > 50_000);

  // GST registration becomes compulsory past $30,000 of revenue in a year.
  const revenueThisYear =
    invoices
      .filter((i) => new Date(i.due_date) >= yearStart)
      .reduce((sum, i) => sum + i.paid_cents, 0) + hubShare + equipmentIncome;

  const GST_THRESHOLD = 3_000_000;

  const membershipIncome = memberships
    .filter((m) => m.status === "active")
    .reduce((s, m) => s + m.monthly_price_cents, 0);

  // Income by part of the business
  const byStream = new Map<string, { collected: number; owed: number }>();
  for (const i of invoices) {
    const cur = byStream.get(i.kind) ?? { collected: 0, owed: 0 };
    cur.collected += i.paid_cents;
    if (i.state === "overdue" || i.state === "outstanding") {
      cur.owed += i.balance_cents;
    }
    byStream.set(i.kind, cur);
  }

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_cents);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryMax = categories[0]?.[1] ?? 1;
  const categoryNames = categories.map(([c]) => c);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Finance</h1>
        <p className="mt-1.5 text-ink-soft">
          Everything that&rsquo;s come in and gone out, across the whole
          business.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Received"
          value={money(collected)}
          sub="All payments to date"
          icon={TrendingUp}
        />
        <Stat
          label="Still owed"
          value={money(owed)}
          sub="Invoiced, not yet paid"
          tone={owed > 0 ? "bad" : "default"}
          icon={Receipt}
        />
        <Stat
          label="Spent"
          value={money(spent)}
          sub="All recorded costs"
          icon={PiggyBank}
        />
        <Stat
          label="Donations"
          value={money(donations)}
          sub={
            donationList.length === 0
              ? "Towards the building fund"
              : `From ${donationList.length} ${donationList.length === 1 ? "gift" : "gifts"}`
          }
          icon={HandHeart}
        />
      </div>

      <Card>
        <CardHeader
          title="The last twelve months"
          description="Money in against money out, month by month."
        />
        <MonthlyChart data={monthly} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income by stream */}
        <Card>
          <CardHeader
            title="Where the income comes from"
            description="Each part of the business, side by side."
          />
          <Table>
            <thead>
              <tr>
                <Th>Part of the business</Th>
                <Th align="right">Received</Th>
                <Th align="right">Still owed</Th>
              </tr>
            </thead>
            <tbody>
              {byStream.size === 0 ? (
                <EmptyRow colSpan={3}>Nothing invoiced yet.</EmptyRow>
              ) : (
                [...byStream.entries()]
                  .sort((a, b) => b[1].collected - a[1].collected)
                  .map(([kind, v]) => (
                    <tr key={kind}>
                      <Td>{STREAM_LABELS[kind] ?? kind}</Td>
                      <Td align="right" className="font-semibold">
                        {moneyExact(v.collected)}
                      </Td>
                      <Td
                        align="right"
                        className={v.owed > 0 ? "text-burgundy" : "text-ink-faint"}
                      >
                        {v.owed > 0 ? moneyExact(v.owed) : "—"}
                      </Td>
                    </tr>
                  ))
              )}
            </tbody>
          </Table>
        </Card>

        {/* Expenses by category */}
        <Card>
          <CardHeader
            title="Where the money goes"
            description="Costs grouped by what they were for."
          />
          <ul className="space-y-3 px-5 py-5">
            {categories.length === 0 ? (
              <li className="py-8 text-center text-sm text-ink-faint">
                No costs recorded yet.
              </li>
            ) : (
              categories.map(([category, cents]) => (
                <li key={category}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span>{category}</span>
                    <span className="font-semibold tabular-nums">
                      {moneyExact(cents)}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-linen"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-sage"
                      style={{ width: `${(cents / categoryMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <AddPanel
        label="Record a cost"
        description="Anything the building or the business has spent money on."
      >
        <ExpenseForm existingCategories={categoryNames} />
      </AddPanel>

      <Card>
        <CardHeader
          title="Recent costs"
          description="Everything recorded, most recent first."
        />
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Who</Th>
              <Th>What for</Th>
              <Th>Category</Th>
              <Th align="right">Amount</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <EmptyRow colSpan={6}>Nothing recorded yet.</EmptyRow>
            ) : (
              expenses
                .slice(0, 20)
                .map((e) => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    categories={categoryNames}
                  />
                ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Classes ---------- */}
      <Card>
        <CardHeader
          title="Classes"
          description="Every class that has actually been taught. A class that was scheduled and cancelled earns nothing and costs nothing."
        />
        <div className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <Figure
            label="Fees taken"
            value={moneyExact(classFees)}
            note={`${seatsTaught} seats across ${delivered.length} sessions`}
          />
          <Figure
            label="Your share"
            value={moneyExact(hubShare)}
            note={`${classSettings.hub_split_percent}% of the class fee`}
          />
          <Figure
            label="Equipment hire"
            value={moneyExact(equipmentIncome)}
            note="Yours, on top of the split"
          />
          <Figure
            label="Instructors' share"
            value={moneyExact(instructorShare)}
            note="Before equipment and storage come off"
          />
          <Figure
            label="Still to pay out"
            value={moneyExact(owedToInstructors)}
            note="Statements not yet marked paid"
            tone={owedToInstructors > 0 ? "bad" : undefined}
          />
          <Figure
            label="Scholarship fund used"
            value={moneyExact(subsidyGiven)}
            note="Made up so reduced and subsidized seats cost the instructor nothing"
          />
        </div>
        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          The scholarship figure is what the sliding scale actually costs. It
          is the difference between what people paid and the full price, and it
          comes out of your share — which is why it is worth watching.
        </p>
      </Card>

      {/* ---------- Memberships ---------- */}
      <Card>
        <CardHeader
          title="Memberships and credits"
          description="Subscription money arrives before the classes are taught, so some of it isn't yours to spend yet."
        />
        <div className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <Figure
            label="Coming in monthly"
            value={moneyExact(membershipIncome)}
            note={`${memberships.filter((m) => m.status === "active").length} active plans`}
          />
          <Figure
            label="Credits unspent"
            value={moneyExact(creditLiability)}
            note="Classes paid for and not yet taught"
            tone={creditLiability > membershipIncome * 2 ? "bad" : undefined}
          />
          <Figure
            label="Drop-in price"
            value={moneyExact(creditSettings.dropin_cents)}
            note={`A credit is worth ${moneyExact(creditValueCents("individual", creditSettings))}`}
          />
        </div>
        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          Credits unspent is a debt, not income — somebody has paid for a class
          you still owe them. Worth keeping that much back rather than counting
          it as takings.
        </p>
      </Card>

      {/* ---------- Donations ---------- */}
      <Card>
        <CardHeader
          title="Donations"
          description="Gifts towards buying and repairing the building. Everyone here has already been thanked by email."
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What they said</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {donationList.length === 0 ? (
              <EmptyRow colSpan={4}>
                No donations yet. They&rsquo;ll appear here as they come in.
              </EmptyRow>
            ) : (
              donationList.map((d) => (
                <tr key={d.id}>
                  <Td>{dateShort(d.received_at)}</Td>
                  <Td>
                    {d.is_anonymous ? (
                      <span className="text-ink-soft">
                        Anonymous
                        {d.donor_name ? (
                          <span className="block text-xs text-ink-faint">
                            {d.donor_name} — asked not to be named publicly
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {d.donor_name ?? "No name given"}
                        </span>
                        {d.email && (
                          <span className="block text-xs text-ink-faint">
                            {d.email}
                          </span>
                        )}
                      </>
                    )}
                  </Td>
                  <Td>
                    {d.message ? (
                      <span className="text-sm text-ink-soft">{d.message}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="font-medium">{moneyExact(d.amount_cents)}</span>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        {donationList.length > 0 && (
          <div className="border-t border-tan/20 px-5 py-3.5 text-right">
            <span className="eyebrow !text-[0.6rem] text-bark">Total raised</span>
            <span className="ml-3 font-display text-xl font-semibold text-olive-deep">
              {moneyExact(donations)}
            </span>
          </div>
        )}
      </Card>

      {/* ---------- Year end ---------- */}
      <Card>
        <CardHeader
          title="Year end"
          description="The two figures that turn into paperwork. Neither is urgent until it is."
        />

        <div className="border-b border-tan/20 px-5 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="eyebrow !text-[0.6rem] text-bark">
                Revenue this year
              </p>
              <p
                className={`mt-1 font-display text-2xl font-semibold ${revenueThisYear >= GST_THRESHOLD ? "text-burgundy" : "text-olive-deep"}`}
              >
                {moneyExact(revenueThisYear)}
              </p>
            </div>
            <p className="max-w-md text-sm text-ink-soft">
              {revenueThisYear >= GST_THRESHOLD ? (
                <>
                  You have passed <strong>$30,000</strong>. Registering for GST
                  is no longer optional — worth speaking to an accountant now
                  rather than at year end.
                </>
              ) : (
                <>
                  GST registration becomes compulsory at{" "}
                  <strong>$30,000</strong> in a year.{" "}
                  {moneyExact(GST_THRESHOLD - revenueThisYear)} to go.
                </>
              )}
            </p>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Paid to</Th>
              <Th align="right">This year</Th>
              <Th align="right">T4A</Th>
            </tr>
          </thead>
          <tbody>
            {t4a.length === 0 ? (
              <EmptyRow colSpan={3}>
                Nobody has been paid out yet this year.
              </EmptyRow>
            ) : (
              t4a.map(({ instructor, paid }) => (
                <tr key={instructor.id}>
                  <Td>{instructor.display_name}</Td>
                  <Td align="right">{moneyExact(paid)}</Td>
                  <Td align="right">
                    <Badge tone={paid > 50_000 ? "warn" : "neutral"}>
                      {paid > 50_000 ? "needed" : "not needed"}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          {t4aNeeded.length > 0 ? (
            <>
              {t4aNeeded.length} instructor
              {t4aNeeded.length === 1 ? " needs a" : "s need"} T4A slip
              {t4aNeeded.length === 1 ? "" : "s"} by the end of February. Only
              statements you have marked paid are counted.
            </>
          ) : (
            <>
              A T4A is required for anyone paid more than $500 in a calendar
              year. Only statements you have marked paid are counted.
            </>
          )}
        </p>
      </Card>

      <p className="text-xs text-ink-faint">
        These figures are a management view, not a tax return — they don&rsquo;t
        account for depreciation, GST filing periods, or accruals. Give your
        accountant the underlying records, not this page.
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "bad";
}) {
  return (
    <div>
      <p className="eyebrow !text-[0.6rem] text-bark">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${tone === "bad" ? "text-burgundy" : "text-olive-deep"}`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}
