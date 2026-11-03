import { Car, Receipt, Repeat } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { BillsPanel } from "@/components/admin/BillsPanel";
import { RepeatingCosts } from "@/components/admin/RepeatingCosts";
import { Mileage } from "@/components/admin/Mileage";
import { Stat } from "@/components/admin/Stat";
import { Card, CardHeader } from "@/components/ui/Table";
import {
  billSummary,
  getBills,
  getMileageRate,
  getRecurringCosts,
  getTrips,
} from "@/lib/data/books";
import { getExpenses } from "@/lib/data/admin";
import { moneyExact } from "@/lib/format";

export const metadata = { title: "Bills and mileage · Room Within" };

export default async function CostsPage() {
  const [bills, recurring, trips, rate, expenses] = await Promise.all([
    getBills(),
    getRecurringCosts(),
    getTrips(),
    getMileageRate(),
    getExpenses(),
  ]);

  // Worked out on the server so the page and the database agree on what
  // "today" is, rather than each using the clock where they happen to run.
  const today = new Date().toISOString().slice(0, 10);

  const summary = billSummary(bills, new Date());
  const categories = [...new Set(expenses.map((e) => e.category))].sort();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Bills and mileage"
        description="What you owe but haven't paid, what comes round again, and the driving."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Owed, not yet paid"
          value={moneyExact(summary.owedCents)}
          icon={Receipt}
          tone={summary.owedCents > 0 ? "default" : "good"}
        />
        <Stat
          label="Of that, overdue"
          value={moneyExact(summary.lateCents)}
          tone={summary.lateCents > 0 ? "bad" : "good"}
          sub={
            summary.late.length > 0
              ? `${summary.late.length} bill${summary.late.length === 1 ? "" : "s"}`
              : undefined
          }
        />
        <Stat
          label="Set up to repeat"
          value={String(recurring.filter((r) => r.is_active).length)}
          icon={Repeat}
        />
      </div>

      <Card>
        <CardHeader
          title="Bills to pay"
          description="An invoice you've been sent but haven't paid. Putting it here means the forecast knows it's coming."
          tone={summary.lateCents > 0 ? "warn" : "default"}
        />
        <BillsPanel bills={bills} categories={categories} today={today} />
      </Card>

      <Card>
        <CardHeader
          title="Costs that come round again"
          description="Insurance, the gas, the water. Set one up once and add each one to your bills when it's due."
        />
        <RepeatingCosts costs={recurring} categories={categories} today={today} />
      </Card>

      <Card>
        <CardHeader
          title="Driving"
          description="Trips made for the building. A real deduction, and one most people never claim."
          tone="sage"
        />
        <Mileage trips={trips} rateCentsPerKm={rate} today={today} />
      </Card>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
        Marking a bill paid records the cost for you, using the bill&rsquo;s own
        figures — so what you owed and what you paid can never disagree. Each
        trip keeps the rate that applied when you made it, so an old year
        doesn&rsquo;t get repriced when the CRA changes the rate.
      </p>
    </div>
  );
}
