import { EmptyRow, Table, Td, Th } from "@/components/ui/Table";
import { moneyExact } from "@/lib/format";
import { roomTotals, type RoomYear } from "@/lib/rooms";
import { cn } from "@/lib/cn";

/**
 * What each room brought in and what it cost.
 *
 * The empty-days column is the one most likely to change a decision. A room
 * that earns well but stands empty four months a year may be worth less than
 * a cheaper one that never does, and nothing else on this page makes that
 * visible.
 */
export function RoomEconomics({ rooms }: { rooms: RoomYear[] }) {
  const totals = roomTotals(rooms);

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <Th>Room</Th>
            <Th>Who&rsquo;s in it</Th>
            <Th align="right">Came in</Th>
            <Th align="right">Spent on it</Th>
            <Th align="right">Left over</Th>
            <Th align="right">Stood empty</Th>
          </tr>
        </thead>
        <tbody>
          {rooms.length === 0 ? (
            <EmptyRow colSpan={6}>No rooms set up yet.</EmptyRow>
          ) : (
            <>
              {rooms.map((r) => (
                <tr key={r.unit.id}>
                  <Td>
                    <span className="font-medium">{r.unit.name}</span>
                    {r.unit.floor && (
                      <span className="block text-xs text-ink-faint">{r.unit.floor}</span>
                    )}
                  </Td>
                  <Td>{r.occupant ?? <span className="text-ink-faint">empty</span>}</Td>
                  <Td align="right">{moneyExact(r.receivedCents)}</Td>
                  <Td align="right">
                    {r.spentCents === 0 ? "—" : moneyExact(r.spentCents)}
                  </Td>
                  <Td align="right">
                    <span className={cn(r.netCents < 0 && "text-burgundy")}>
                      {moneyExact(r.netCents)}
                    </span>
                  </Td>
                  <Td align="right">
                    {r.emptyDays === 0 ? (
                      "—"
                    ) : (
                      <>
                        {r.emptyDays} {r.emptyDays === 1 ? "day" : "days"}
                        <span className="block text-xs text-burgundy">
                          {moneyExact(r.vacancyCents)} not earned
                        </span>
                      </>
                    )}
                  </Td>
                </tr>
              ))}
              <tr className="bg-parchment font-medium">
                <Td>The building</Td>
                <Td />
                <Td align="right">{moneyExact(totals.receivedCents)}</Td>
                <Td align="right">{moneyExact(totals.spentCents)}</Td>
                <Td align="right">{moneyExact(totals.netCents)}</Td>
                <Td align="right">
                  {totals.emptyDays === 0 ? "—" : `${totals.emptyDays} days`}
                </Td>
              </tr>
            </>
          )}
        </tbody>
      </Table>

      <p className="border-t border-tan/20 px-5 py-3.5 text-xs leading-relaxed text-ink-faint">
        &ldquo;Spent on it&rdquo; is only money attached to that room — repairs,
        and any expense you tagged to it. Insurance, heating and the accountant
        belong to the building and are not divided up here, because splitting
        them by floor area would give a figure that looks precise and tells you
        nothing. &ldquo;Not earned&rdquo; is the asking rent for the days it
        stood empty.
      </p>
    </div>
  );
}
