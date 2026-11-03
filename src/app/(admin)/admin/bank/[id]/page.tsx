import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { BankLineCard } from "@/components/admin/BankLineCard";
import { StatementCorrections } from "@/components/admin/StatementCorrections";
import { Card, CardHeader, Table, Td, Th, EmptyRow } from "@/components/ui/Table";
import { getBankImport, getKnownEntries } from "@/lib/data/bank";
import { getExpenses } from "@/lib/data/admin";
import { asRules, getBankRules } from "@/lib/data/books";
import { ruleFor, suggestMatchText } from "@/lib/bank-rules";
import { reconcile, type BankLine } from "@/lib/reconcile";
import { dateShort, moneyExact } from "@/lib/format";

export const metadata = { title: "Statement · Room Within" };

/**
 * One statement, line by line.
 *
 * The matching is worked out here, on every page load, rather than stored when
 * the file was read. That costs a few milliseconds and buys two things: a
 * proposal can never be mistaken for a decision, and when the matching is
 * improved every statement already read in gets the benefit instead of being
 * stuck with the guesses of the day it was uploaded.
 */
export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const found = await getBankImport(id);
  if (!found) notFound();

  const { statement, lines } = found;

  const known = await getKnownEntries(
    statement.period_start ?? lines[0]?.occurred_on ?? "1970-01-01",
    statement.period_end ?? lines[lines.length - 1]?.occurred_on ?? "2999-12-31",
  );

  // Only the undecided lines go to the matcher. A line already ticked off has
  // its answer, and offering it the record it is already attached to would be
  // noise at best — and at worst would look like the record was still free.
  const openLines: BankLine[] = lines
    .filter((l) => l.status === "open")
    .map((l) => ({
      line: l.line_no,
      date: l.occurred_on,
      description: l.description,
      amountCents: l.amount_cents,
    }));

  const proposal = reconcile(openLines, known);
  const byLineNo = new Map(proposal.results.map((r) => [r.bank.line, r]));

  const [expenses, ruleRows] = await Promise.all([getExpenses(), getBankRules()]);
  const categories = [...new Set(expenses.map((e) => e.category))].sort();
  const rules = asRules(ruleRows);

  // Worked out once per line here rather than inside each card, so the card
  // stays a dumb renderer and the matching is done in one place.
  const ruleForLine = (l: { description: string; amount_cents: number }) =>
    ruleFor({ description: l.description, amountCents: l.amount_cents }, rules);

  const settledCount = lines.filter((l) => l.status !== "open").length;
  const everythingOpen = settledCount === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="The bank"
        title={`${statement.period_start ? dateShort(statement.period_start) : "?"} — ${
          statement.period_end ? dateShort(statement.period_end) : "?"
        }`}
        description={`${statement.line_count} line${
          statement.line_count === 1 ? "" : "s"
        } · ${moneyExact(statement.money_in_cents)} in, ${moneyExact(
          Math.abs(statement.money_out_cents),
        )} out · ${settledCount} of ${lines.length} dealt with`}
      />

      <Link
        href="/admin/bank"
        className="inline-flex items-center gap-1.5 text-sm text-bark underline underline-offset-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All statements
      </Link>

      {/* How the file was read, and how to correct it if it was read wrongly. */}
      <StatementCorrections
        importId={statement.id}
        reading={statement.reading}
        everythingOpen={everythingOpen}
      />

      <Card>
        <CardHeader
          title="Still to deal with"
          description="Each of these needs one decision. Nothing is written down until you make it."
          tone={proposal.totals.open > 0 ? "warn" : "sage"}
        />
        {lines.filter((l) => l.status === "open").length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-soft">
            Every line on this statement has been dealt with.
          </p>
        ) : (
          lines
            .filter((l) => l.status === "open")
            .map((l) => (
              <BankLineCard
                key={l.id}
                line={l}
                proposal={byLineNo.get(l.line_no) ?? null}
                categories={categories}
                rule={
                  ruleForLine(l)
                    ? {
                        matchText: ruleForLine(l)!.rule.matchText,
                        category: ruleForLine(l)!.rule.category,
                        vendor: ruleForLine(l)!.rule.vendor,
                      }
                    : null
                }
                suggestedMatch={suggestMatchText(l.description)}
              />
            ))
        )}
      </Card>

      {/* Records with no line against them. The reason the page exists. */}
      {proposal.missing.length > 0 && (
        <Card>
          <CardHeader
            title="On your books, but not on this statement"
            description="Either it hasn't cleared yet, or it never happened. The second kind is worth chasing."
            tone="warn"
          />
          <Table>
            <thead>
              <tr>
                <Th>What</Th>
                <Th>Dated</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {proposal.missing.map((m) => (
                <tr key={`${m.kind}-${m.id}`}>
                  <Td>
                    {m.label}
                    <span className="block text-xs text-ink-faint">
                      {m.kind === "payment" ? "payment in" : "cost"}
                    </span>
                  </Td>
                  <Td>{dateShort(m.date)}</Td>
                  <Td align="right">{moneyExact(Math.abs(m.amountCents))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
            A cheque written near the end of the month often hasn&rsquo;t cleared
            and will turn up on the next statement. A rent payment that never
            appears is a different matter.
          </p>
        </Card>
      )}

      {settledCount > 0 && (
        <Card>
          <CardHeader
            title="Dealt with"
            description="What you decided, and when. Any of it can be undone."
            tone="plain"
          />
          {lines
            .filter((l) => l.status !== "open")
            .map((l) => (
              <BankLineCard
                key={l.id}
                line={l}
                proposal={null}
                categories={categories}
                rule={null}
                suggestedMatch=""
              />
            ))}
        </Card>
      )}

      {lines.length === 0 && (
        <Card>
          <CardHeader title="Nothing in this statement" tone="warn" />
          <EmptyRow colSpan={1}>
            No rows were stored for this file, which shouldn&rsquo;t happen —
            best to delete it and read it in again.
          </EmptyRow>
        </Card>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Amounts have to match to the penny before this offers you a tick. Where
        nothing matches exactly it shows you what&rsquo;s close and by how much,
        rather than guessing — a wrong tick makes the books look right when they
        aren&rsquo;t.
      </p>
    </div>
  );
}
