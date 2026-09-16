import { CheckCircle2, Flag, ListChecks, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Stat } from "@/components/admin/Stat";
import { Gate, Task } from "@/components/admin/Plan";
import { Badge, Card, CardHeader } from "@/components/ui/Table";
import { getGates, getProjectTasks } from "@/lib/data/plan";
import { daysUntil } from "@/lib/opportunities";

export const metadata = { title: "The plan" };

/**
 * The building project: five gates and the task register behind them.
 *
 * Lifted out of Tausha's workbook. The gates come first because they are the
 * decisions that commit money — the tasks underneath are how each one gets
 * reached.
 */
export default async function PlanPage() {
  const [gates, tasks] = await Promise.all([getGates(), getProjectTasks()]);

  const today = new Date();
  const isOverdue = (date: string | null) => {
    const days = daysUntil(date, today);
    return days !== null && days < 0;
  };

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const overdue = open.filter((t) => isOverdue(t.due_on));

  const critical = open.filter((t) => t.priority === "critical");
  const currentGate =
    gates.find((g) => g.status === "in_progress") ??
    gates.find((g) => g.status !== "passed");

  // The register is ordered by phase, and the phase string carries its own
  // number ("0 Foundation"), so a plain sort keeps them in the right order.
  const phases = [...new Set(tasks.map((t) => t.phase))].sort();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The building"
        title="The plan"
        description="The gates that decide when money gets spent, and the work that leads to each one."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Where we are"
          value={currentGate ? `Gate ${currentGate.position}` : "Done"}
          sub={currentGate?.decision ?? "Every gate passed"}
          icon={Flag}
        />
        <Stat
          label="Still to do"
          value={String(open.length)}
          sub={`${done.length} of ${tasks.length} finished`}
          icon={ListChecks}
        />
        <Stat
          label="Critical and open"
          value={String(critical.length)}
          sub="The ones that hold everything else up"
          tone={critical.length > 0 ? "bad" : "good"}
        />
        <Stat
          label="Past their date"
          value={String(overdue.length)}
          sub={blocked.length > 0 ? `${blocked.length} blocked` : "Nothing blocked"}
          icon={TriangleAlert}
          tone={overdue.length > 0 ? "bad" : "default"}
        />
      </div>

      {/* ---------- The gates ---------- */}
      <Card>
        <CardHeader
          title="Phase gates"
          tone="olive"
          description="Don't advance until the gate is true. Each one lists what has to be in place first, and what it risks if it's skipped anyway."
        />
        <div>
          {gates.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-faint">
              No gates set.
            </p>
          ) : (
            gates.map((g) => (
              <Gate key={g.id} gate={g} overdue={isOverdue(g.target_on)} />
            ))
          )}
        </div>
      </Card>

      {/* ---------- The register ---------- */}
      {phases.map((phase) => {
        const inPhase = tasks.filter((t) => t.phase === phase);
        const finished = inPhase.filter((t) => t.status === "done").length;
        const allDone = finished === inPhase.length;

        return (
          <Card key={phase}>
            <CardHeader
              title={phase.replace(/^\d+\s/, "")}
              tone={allDone ? "default" : "plain"}
              action={
                <Badge tone={allDone ? "good" : "neutral"}>
                  {allDone ? (
                    <>
                      <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden />
                      all done
                    </>
                  ) : (
                    `${finished}/${inPhase.length}`
                  )}
                </Badge>
              }
            />
            <ul>
              {inPhase.map((t) => (
                <Task key={t.id} task={t} overdue={isOverdue(t.due_on)} />
              ))}
            </ul>
          </Card>
        );
      })}

      <p className="text-xs leading-relaxed text-ink-faint">
        This came out of the project workbook. It covers the building purchase
        and getting the doors open — the day-to-day of running the place lives
        on the other pages.
      </p>
    </div>
  );
}
