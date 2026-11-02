"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";
import { updateCashBalance } from "@/app/(admin)/admin/finance/actions";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { EmptyRow, Table, Td, Th } from "@/components/ui/Table";
import { dateShort, moneyExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Forecast } from "@/lib/forecast";
import type { CashSettings } from "@/lib/data/settings";

/** A figure typed more than six weeks ago isn't worth forecasting from. */
const STALE_DAYS = 45;

export function CashForecast({
  forecast,
  cash,
}: {
  forecast: Forecast;
  cash: CashSettings;
}) {
  const [result, action] = useActionState(updateCashBalance, null);

  const asOf = cash.as_of ? new Date(`${cash.as_of}T00:00:00`) : null;
  const ageDays = asOf
    ? Math.floor((Date.now() - asOf.getTime()) / 86_400_000)
    : null;
  const stale = ageDays === null || ageDays > STALE_DAYS;

  return (
    <div>
      {/* The number everything else hangs off, so it comes first and says how
          old it is. */}
      <form
        action={action}
        className={cn(
          "flex flex-wrap items-end gap-4 border-b border-tan/20 px-5 py-4",
          stale ? "bg-burgundy/5" : "bg-parchment",
        )}
      >
        <Field label="What's in the account today">
          <div className="flex items-center gap-2">
            <span className="text-ink-soft">$</span>
            <input
              name="balance"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(cash.balance_cents / 100).toFixed(2)}
              className={inputClass}
            />
          </div>
        </Field>
        <SubmitButton>Save</SubmitButton>
        <p className="flex-1 text-xs leading-relaxed text-ink-faint">
          {asOf ? (
            stale ? (
              <span className="text-burgundy">
                Last updated {dateShort(cash.as_of!)} — {ageDays} days ago. The
                figures below are only as good as this one.
              </span>
            ) : (
              <>Last updated {dateShort(cash.as_of!)}.</>
            )
          ) : (
            <span className="text-burgundy">
              Type what&rsquo;s in the account and the rest of this becomes
              useful. Until then it&rsquo;s counting from nothing.
            </span>
          )}
        </p>
        <Feedback result={result} />
      </form>

      {forecast.shortfall && !stale && (
        <p className="flex items-start gap-2 border-b border-tan/20 bg-burgundy/10 px-5 py-3.5 text-sm leading-relaxed text-burgundy">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            On these figures the account runs out in{" "}
            <strong>{forecast.shortfall.label}</strong>, down to{" "}
            {moneyExact(forecast.shortfall.cents)}. Worth looking at before it
            is this month&rsquo;s problem.
          </span>
        </p>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Month</Th>
            <Th align="right">Rent due</Th>
            <Th align="right">Already invoiced</Th>
            <Th align="right">Regular costs</Th>
            <Th align="right">Net</Th>
            <Th align="right">Left in the account</Th>
          </tr>
        </thead>
        <tbody>
          {forecast.months.length === 0 ? (
            <EmptyRow colSpan={6}>Nothing to forecast from yet.</EmptyRow>
          ) : (
            forecast.months.map((m) => (
              <tr key={m.month}>
                <Td>{m.label}</Td>
                <Td align="right">
                  {m.rentCents === 0 ? "—" : moneyExact(m.rentCents)}
                </Td>
                <Td align="right">
                  {m.invoicedCents === 0 ? "—" : moneyExact(m.invoicedCents)}
                </Td>
                <Td align="right">
                  <span className="text-ink-faint">
                    {m.outCents === 0 ? "—" : `−${moneyExact(m.outCents)}`}
                  </span>
                </Td>
                <Td align="right">
                  <span className={cn(m.netCents < 0 && "text-burgundy")}>
                    {moneyExact(m.netCents)}
                  </span>
                </Td>
                <Td align="right">
                  <span
                    className={cn(
                      "font-medium",
                      m.balanceCents < 0 ? "text-burgundy" : "text-olive-deep",
                    )}
                  >
                    {moneyExact(m.balanceCents)}
                  </span>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <div className="border-t border-tan/20 px-5 py-4 text-xs leading-relaxed text-ink-faint">
        <p>
          <strong className="text-ink-soft">Rent due</strong> and{" "}
          <strong className="text-ink-soft">already invoiced</strong> are known:
          signed tenancies and bills that exist. A tenancy that ends stops
          paying in the month it ends, which is the whole point of looking
          ahead. This month shows no rent line because the rent is already in
          the invoiced column.
        </p>
        <p className="mt-2">
          <strong className="text-ink-soft">Regular costs</strong> is a guess,
          and a cautious one:{" "}
          {forecast.regular.length === 0 ? (
            <>nothing yet appears in enough months to count as regular.</>
          ) : (
            <>
              only what turned up in at least three of the last six months,
              counted at the middle figure rather than the average, so one big
              repair doesn&rsquo;t become a monthly expectation. Right now
              that&rsquo;s{" "}
              {forecast.regular
                .map((r) => `${r.category} ${moneyExact(r.cents)}`)
                .join(", ")}
              .
            </>
          )}
        </p>
        <p className="mt-2">
          Nothing hoped for is in here — no grant that might come, no room that
          might let. A forecast with hopes in it is a wish, and this one is for
          deciding whether a bill can be paid.
        </p>
      </div>
    </div>
  );
}
