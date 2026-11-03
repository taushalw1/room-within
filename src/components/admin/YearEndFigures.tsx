import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import type { YearEnd } from "@/lib/year-end";
import { moneyExact } from "@/lib/format";

/**
 * The year's figures, as cards.
 *
 * Shared by Tausha's year-end page and the accountant's read-only area, so
 * the two can never show different numbers for the same year — which is
 * exactly the kind of difference that would cost an hour on the phone to
 * explain.
 */
export function YearEndFigures({
  result,
  year,
}: {
  result: YearEnd;
  year: number;
}) {
  return (
    <>
      {/* ---------- The headline ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Money in" value={moneyExact(result.income.totalCents)} />
        <Figure label="Money out" value={moneyExact(result.costs.totalCents)} />
        <Figure
          label="Difference"
          value={moneyExact(result.netCents)}
          tone={result.netCents < 0 ? "bad" : "good"}
        />
      </div>

      {/* ---------- Income ---------- */}
      <Card>
        <CardHeader
          title="Where it came from"
          description="Money that actually arrived in the year, not invoices raised."
        />
        <Table>
          <thead>
            <tr>
              <Th>Stream</Th>
              <Th align="right">Received</Th>
            </tr>
          </thead>
          <tbody>
            {result.income.byStream.length === 0 &&
            result.income.donationsCents === 0 ? (
              <EmptyRow colSpan={2}>Nothing recorded for {year}.</EmptyRow>
            ) : (
              <>
                {result.income.byStream.map((s) => (
                  <tr key={s.label}>
                    <Td>{s.label}</Td>
                    <Td align="right">{moneyExact(s.cents)}</Td>
                  </tr>
                ))}
                {result.income.donationsCents > 0 && (
                  <tr>
                    <Td>Donations</Td>
                    <Td align="right">{moneyExact(result.income.donationsCents)}</Td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td align="right">{moneyExact(result.income.totalCents)}</Td>
                </tr>
              </>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Costs ---------- */}
      <Card>
        <CardHeader
          title="Where it went"
          description="Grouped the way you categorised them as you entered them."
        />
        <Table>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th align="right">Spent</Th>
              <Th align="right">GST in that</Th>
            </tr>
          </thead>
          <tbody>
            {result.costs.byCategory.length === 0 ? (
              <EmptyRow colSpan={3}>Nothing recorded for {year}.</EmptyRow>
            ) : (
              <>
                {result.costs.byCategory.map((c) => (
                  <tr key={c.label}>
                    <Td>{c.label}</Td>
                    <Td align="right">{moneyExact(c.cents)}</Td>
                    <Td align="right">{moneyExact(c.taxCents)}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td align="right">{moneyExact(result.costs.totalCents)}</Td>
                  <Td align="right">{moneyExact(result.gst.paidCents)}</Td>
                </tr>
              </>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- GST ---------- */}
      <Card>
        <CardHeader
          title="GST"
          description="Only matters if you're registered. It becomes compulsory above $30,000 of revenue in a year."
          tone={result.gst.overThreshold ? "warn" : "default"}
        />
        <Table>
          <tbody>
            <tr>
              <Td>Collected, on invoices that were paid</Td>
              <Td align="right">{moneyExact(result.gst.collectedCents)}</Td>
            </tr>
            <tr>
              <Td>Paid out, on your costs</Td>
              <Td align="right">{moneyExact(result.gst.paidCents)}</Td>
            </tr>
            <tr className="font-semibold">
              <Td>
                {result.gst.netCents >= 0
                  ? "Difference — what you'd remit"
                  : "Difference — what you'd get back"}
              </Td>
              <Td align="right">{moneyExact(Math.abs(result.gst.netCents))}</Td>
            </tr>
          </tbody>
        </Table>
        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          {result.gst.overThreshold ? (
            <>
              Revenue passed <strong>$30,000</strong> in {year}, so registering
              is no longer optional. Worth a conversation with an accountant
              rather than leaving it to the deadline.
            </>
          ) : (
            <>
              Revenue was under <strong>$30,000</strong>, so registration
              wasn&rsquo;t compulsory for {year}.
            </>
          )}
        </p>
      </Card>

      {/* ---------- T4A ---------- */}
      <Card>
        <CardHeader
          title="People you paid"
          description="A T4A is required for anyone paid more than $500 in a calendar year, by the end of February."
        />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th align="right">Paid in {year}</Th>
              <Th align="right">T4A</Th>
            </tr>
          </thead>
          <tbody>
            {result.t4a.length === 0 ? (
              <EmptyRow colSpan={3}>Nobody was paid out in {year}.</EmptyRow>
            ) : (
              result.t4a.map((t) => (
                <tr key={t.name}>
                  <Td>{t.name}</Td>
                  <Td align="right">{moneyExact(t.paidCents)}</Td>
                  <Td align="right">
                    <Badge tone={t.needed ? "warn" : "neutral"}>
                      {t.needed ? "needed" : "not needed"}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

    </>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-l-4 border-tan/25 border-l-sage bg-cream p-5">
      <p className="eyebrow !text-[0.62rem] text-bark">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          tone === "bad" ? "text-burgundy" : "text-olive-deep"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
