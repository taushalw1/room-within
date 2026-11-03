import Link from "next/link";
import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Table";
import { YearEndFigures } from "@/components/admin/YearEndFigures";
import { getYearEndInput, getYearsWithActivity } from "@/lib/data/year-end";
import { buildYearEnd } from "@/lib/year-end";
import { getLockDate } from "@/lib/data/books";
import { dateLong } from "@/lib/format";

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: asked } = await searchParams;

  const [years, lockedBefore] = await Promise.all([
    getYearsWithActivity(),
    getLockDate(),
  ]);

  const year =
    asked && years.includes(Number(asked))
      ? Number(asked)
      : (years[0] ?? new Date().getFullYear());

  const result = buildYearEnd(await getYearEndInput(year));

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] bg-olive px-6 py-6 text-cream sm:px-8">
        <p className="eyebrow !text-[0.62rem] text-cream/70">Room Within Community</p>
        <h1 className="font-display text-3xl font-semibold">The books, {year}</h1>
        <p className="mt-1 max-w-2xl text-sm text-cream/80">
          Prepared on a cash basis — money that arrived and money that left
          inside the year, not invoices raised.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5">
          {years.slice(0, 6).map((y) => (
            <Link
              key={y}
              href={`/books?year=${y}`}
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

        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href={`/admin/finance/year-end/download?year=${year}&what=summary`}
            size="sm"
            variant="secondary"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Summary
          </ButtonLink>
          <ButtonLink
            href={`/admin/finance/year-end/download?year=${year}&what=transactions`}
            size="sm"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Every transaction
          </ButtonLink>
        </div>
      </div>

      {/* Whether the year is closed is the first thing an accountant wants to
          know: an open year is one whose figures can still move. */}
      <Card>
        <CardHeader
          title={
            lockedBefore && `${year}-12-31` < lockedBefore
              ? "This year is closed"
              : "This year is still open"
          }
          description={
            lockedBefore
              ? `The books are closed up to ${dateLong(lockedBefore)}. Nothing dated before then can be added or changed.`
              : "No period has been closed, so earlier figures can still change."
          }
          tone={lockedBefore && `${year}-12-31` < lockedBefore ? "sage" : "warn"}
        />
      </Card>

      <YearEndFigures result={result} year={year} />

      <div className="rounded-[var(--radius-card)] border border-tan/25 bg-parchment/50 px-5 py-4 text-xs leading-relaxed text-ink-soft">
        <p>
          There is no depreciation, capital cost allowance or accrual in these
          figures. They are a clean set of records, not a return.
        </p>
      </div>
    </div>
  );
}
