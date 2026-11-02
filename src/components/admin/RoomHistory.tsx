import { Badge, EmptyRow, Table, Td, Th } from "@/components/ui/Table";
import { dateShort, moneyExact } from "@/lib/format";
import type { MaintenanceRequestRow, UnitRow } from "@/lib/data/types";

/**
 * Every repair ever reported, grouped by room.
 *
 * Read down a single column and a pattern appears that is invisible in a list
 * sorted by date: the same radiator, three winters running. The repeats are
 * called out rather than left to be noticed.
 */
export function RoomHistory({
  histories,
}: {
  histories: {
    unit: UnitRow;
    history: MaintenanceRequestRow[];
    summary: {
      total: number;
      spentCents: number;
      openCount: number;
      repeats: { title: string; times: number }[];
    };
  }[];
}) {
  const withAny = histories.filter((h) => h.history.length > 0);

  if (withAny.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-soft">
        Nothing reported yet against any room.
      </p>
    );
  }

  return (
    <div>
      {withAny.map(({ unit, history, summary }) => (
        <div key={unit.id}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-tan/20 bg-parchment px-5 py-3">
            <p className="font-medium text-ink">{unit.name}</p>
            <p className="text-sm text-ink-soft">
              {summary.total} {summary.total === 1 ? "report" : "reports"}
              {summary.spentCents > 0 && ` · ${moneyExact(summary.spentCents)} spent`}
              {summary.openCount > 0 && ` · ${summary.openCount} still open`}
            </p>
          </div>

          {summary.repeats.length > 0 && (
            <p className="border-b border-tan/20 bg-burgundy/5 px-5 py-2.5 text-sm text-burgundy">
              Reported more than once:{" "}
              {summary.repeats
                .map((r) => `${r.title} (${r.times} times)`)
                .join(", ")}
              .
            </p>
          )}

          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>What</Th>
                <Th>Who reported it</Th>
                <Th align="right">Cost</Th>
                <Th align="right">State</Th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <EmptyRow colSpan={5}>Nothing reported.</EmptyRow>
              ) : (
                history.map((r) => (
                  <tr key={r.id}>
                    <Td>{dateShort(r.created_at)}</Td>
                    <Td>{r.title}</Td>
                    <Td>{r.reported_by}</Td>
                    <Td align="right">
                      {r.cost_cents == null ? "—" : moneyExact(r.cost_cents)}
                    </Td>
                    <Td align="right">
                      <Badge
                        tone={
                          r.status === "fixed"
                            ? "good"
                            : r.status === "declined"
                              ? "neutral"
                              : "warn"
                        }
                      >
                        {r.status === "fixed" ? "Fixed" : r.status === "declined" ? "Not done" : "Open"}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      ))}
    </div>
  );
}
