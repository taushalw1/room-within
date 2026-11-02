import { Hammer } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader } from "@/components/ui/Table";
import { Stat } from "@/components/admin/Stat";
import {
  Contractors,
  RecurringTasks,
  Warranties,
} from "@/components/admin/Building";
import { RoomHistory } from "@/components/admin/RoomHistory";
import {
  getContractors,
  getRecurringTasks,
  getRepairHistory,
  getWarranties,
} from "@/lib/data/building";
import { dueState, repairSummary } from "@/lib/building";
import { getUnits } from "@/lib/data/admin";
import { signedUrl } from "@/lib/maintenance-files";
import { moneyExact } from "@/lib/format";

export const metadata = { title: "The building" };

export default async function BuildingPage() {
  await requireAdmin();

  const [contractors, tasks, warranties, units] = await Promise.all([
    getContractors(),
    getRecurringTasks(),
    getWarranties(),
    getUnits(),
  ]);

  const documentUrls = await Promise.all(
    warranties.map((w) => signedUrl(w.document_path)),
  );

  // The repair history, per unit, with the repeats picked out.
  const histories = await Promise.all(
    units.map(async (unit) => {
      const history = await getRepairHistory(unit.id);
      return { unit, history, summary: repairSummary(history) };
    }),
  );

  const overdue = tasks.filter((t) => dueState(t.next_due_on).days < 0).length;
  const expiringSoon = warranties.filter((w) => {
    if (!w.expires_on) return false;
    const d = dueState(w.expires_on).days;
    return d >= 0 && d <= 90;
  }).length;
  const spent = histories.reduce((t, h) => t + h.summary.spentCents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Looking after it"
        title="The building"
        description="Who you call, the jobs that come round, what's still under warranty, and what each room has cost you."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Jobs overdue"
          value={String(overdue)}
          sub={overdue === 0 ? "Nothing behind" : "Past their date"}
          icon={Hammer}
        />
        <Stat
          label="Cover running out"
          value={String(expiringSoon)}
          sub="Within three months"
          icon={Hammer}
        />
        <Stat
          label="Spent on repairs"
          value={moneyExact(spent)}
          sub="Everything recorded so far"
          icon={Hammer}
        />
      </div>

      <Card>
        <CardHeader
          title="Jobs that come round"
          description="Counted from the day a job was actually done, not the day it was due — so being late once doesn't make every year afterwards slightly wrong."
        />
        <RecurringTasks tasks={tasks} units={units} contractors={contractors} />
      </Card>

      <Card>
        <CardHeader
          title="Who you call"
          description="Numbers, and how it went last time."
        />
        <Contractors contractors={contractors} />
      </Card>

      <Card>
        <CardHeader
          title="Still under warranty"
          description="A furnace with eight years of cover left is worth nothing if nobody can find the paperwork on the morning it stops."
        />
        <Warranties warranties={warranties} units={units} documentUrls={documentUrls} />
      </Card>

      <Card>
        <CardHeader
          title="What each room has cost"
          description="The third time the same thing is reported, the question stops being who can fix it and becomes whether it should be replaced."
        />
        <RoomHistory histories={histories} />
      </Card>
    </div>
  );
}
