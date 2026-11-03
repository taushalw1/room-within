import Link from "next/link";
import { ArrowLeft, Download, Info } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { getYearEndInput, getYearsWithActivity } from "@/lib/data/year-end";
import { buildYearEnd } from "@/lib/year-end";
import { moneyExact } from "@/lib/format";

export const metadata = { title: "Year end · Room Within" };

export default async function YearEndPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: asked } = await searchParams;

  const years = await getYearsWithActivity();
  const year =
    asked && years.includes(Number(asked)) ? Number(asked) : (years[0] ?? new Date().getFullYear());

  const result = buildYearEnd(await getYearEndInput(year));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title={`Year end ${year}`}
        description="Everything an accountant will ask for, in one place and in two files."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/finance"
          className="inline-flex items-center gap-1.5 text-sm text-bark underline underline-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Finance
        </Link>
        <nav className="flex flex-wrap gap-1.5">
          {years.slice(0, 6).map((y) => (
            <Link
              key={y}
              href={`/admin/finance/year-end?year=${y}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                y === year
                  ? "bg-olive text-cream"
                  : "bg-linen text-ink-soft hover:bg-sage-pale"
              }`}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {/* ---------- The files ---------- */}
      <Card>
        <CardHeader
          title="The two files to send"
          description="Email both. The second one is the one they'll actually work from."
          tone="olive"
        />
        <div className="flex flex-wrap gap-3 px-5 py-5">
          <ButtonLink
            href={`/admin/finance/year-end/download?year=${year}&what=summary`}
            size="sm"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Summary for {year}
          </ButtonLink>
          <ButtonLink
            href={`/admin/finance/year-end/download?year=${year}&what=transactions`}
            size="sm"
            variant="secondary"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Every transaction in {year}
          </ButtonLink>
        </div>
        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          Both open in Excel, Numbers or Google Sheets.
        </p>
      </Card>

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

      <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-tan/25 bg-parchment/50 px-5 py-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-bark" aria-hidden />
        <div className="space-y-1.5 text-xs leading-relaxed text-ink-soft">
          <p>
            <strong className="text-bark">
              These figures are on a cash basis
            </strong>{" "}
            — money that arrived and money that left inside {year}, not
            invoices raised. Say so when you send them, because the other way
            of counting gives different numbers.
          </p>
          <p>
            There is no depreciation, no capital cost allowance and no
            accruals here. Those need judgement about what an asset is worth
            and how long it lasts, which is your accountant&rsquo;s job and
            not something this page should guess at. This is a clean set of
            records to hand over, not a tax return.
          </p>
        </div>
      </div>
    </div>
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
