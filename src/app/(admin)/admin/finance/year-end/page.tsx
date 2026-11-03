import Link from "next/link";
import { ArrowLeft, Download, Info } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { YearEndFigures } from "@/components/admin/YearEndFigures";
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

      <YearEndFigures result={result} year={year} />

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
