import { HandHeart, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { MonthlyChart } from "@/components/admin/MonthlyChart";
import { Stat } from "@/components/admin/Stat";
import {
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import {
  getExpenses,
  getInvoices,
  getMonthlyTotals,
} from "@/lib/data/admin";
import { isDemoMode } from "@/lib/demo";
import { sampleDonationTotalCents } from "@/lib/data/sample-admin";
import { dateShort, money, moneyExact } from "@/lib/format";

const STREAM_LABELS: Record<string, string> = {
  rent: "Rent",
  booking: "Room bookings",
  counselling: "Counselling",
  deposit: "Deposits",
  other: "Other",
};

export default async function FinancePage() {
  const [invoices, expenses, monthly] = await Promise.all([
    getInvoices(),
    getExpenses(),
    getMonthlyTotals(),
  ]);

  const collected = invoices.reduce((s, i) => s + i.paid_cents, 0);
  const owed = invoices
    .filter((i) => i.state === "overdue" || i.state === "outstanding")
    .reduce((s, i) => s + i.balance_cents, 0);
  const spent = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const donations = isDemoMode ? sampleDonationTotalCents : 0;

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
          sub="Towards the building fund"
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

      <Card>
        <CardHeader
          title="Recent costs"
          description="Ask Claude to add a cost — just tell it what you spent and on what."
        />
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Who</Th>
              <Th>What for</Th>
              <Th>Category</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <EmptyRow colSpan={5}>Nothing recorded yet.</EmptyRow>
            ) : (
              expenses.slice(0, 12).map((e) => (
                <tr key={e.id}>
                  <Td>{dateShort(e.incurred_on)}</Td>
                  <Td>{e.vendor ?? "—"}</Td>
                  <Td className="text-ink-soft">{e.description ?? "—"}</Td>
                  <Td>{e.category}</Td>
                  <Td align="right" className="font-semibold">
                    {moneyExact(e.amount_cents)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs text-ink-faint">
        These figures are a management view, not a tax return — they don&rsquo;t
        account for depreciation, GST filing periods, or accruals. Give your
        accountant the underlying records, not this page.
      </p>
    </div>
  );
}
