import Link from "next/link";
import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AddPanel } from "@/components/admin/AddPanel";
import { BankImportForm } from "@/components/admin/BankImportForm";
import { Stat } from "@/components/admin/Stat";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { getBankImports, getOpenBankLines } from "@/lib/data/bank";
import { dateShort, moneyExact } from "@/lib/format";

export const metadata = { title: "The bank · Room Within" };

export default async function BankPage() {
  const [statements, open] = await Promise.all([
    getBankImports(),
    getOpenBankLines(),
  ]);

  const openByImport = new Map<string, number>();
  for (const line of open) {
    openByImport.set(line.import_id, (openByImport.get(line.import_id) ?? 0) + 1);
  }

  const oldestOpen = open[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="The bank"
        description="Read your statement in and tick it off against your books. What's left over is what's worth knowing."
      />

      {statements.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Statements read"
            value={String(statements.length)}
            icon={Landmark}
          />
          <Stat
            label="Lines still to deal with"
            value={String(open.length)}
            tone={open.length > 0 ? "bad" : "good"}
          />
          <Stat
            label="Oldest one waiting"
            value={oldestOpen ? dateShort(oldestOpen.occurred_on) : "—"}
          />
        </div>
      )}

      <AddPanel
        label="Read in a statement"
        title="Read in a statement"
        description="A CSV download from your bank. Any bank — I'll work out the columns."
      >
        <BankImportForm />
      </AddPanel>

      <Card>
        <CardHeader
          title="Statements"
          description="Newest first. A statement stays here once it's done, so you can look back at what you decided."
        />
        <Table>
          <thead>
            <tr>
              <Th>Period</Th>
              <Th>File</Th>
              <Th align="right">In</Th>
              <Th align="right">Out</Th>
              <Th align="right">Left to do</Th>
            </tr>
          </thead>
          <tbody>
            {statements.length === 0 ? (
              <EmptyRow colSpan={5}>
                Nothing read in yet. Download a statement from your bank and use
                the panel above.
              </EmptyRow>
            ) : (
              statements.map((s) => {
                const left = openByImport.get(s.id) ?? 0;
                return (
                  <tr key={s.id}>
                    <Td>
                      <Link
                        href={`/admin/bank/${s.id}`}
                        className="font-semibold text-olive-deep underline underline-offset-2"
                      >
                        {s.period_start ? dateShort(s.period_start) : "?"} —{" "}
                        {s.period_end ? dateShort(s.period_end) : "?"}
                      </Link>
                      <span className="block text-xs text-ink-faint">
                        {s.line_count} line{s.line_count === 1 ? "" : "s"}, read in{" "}
                        {dateShort(s.imported_at)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-ink-soft">
                        {s.filename ?? "—"}
                      </span>
                    </Td>
                    <Td align="right">{moneyExact(s.money_in_cents)}</Td>
                    <Td align="right">
                      {moneyExact(Math.abs(s.money_out_cents))}
                    </Td>
                    <Td align="right">
                      {left === 0 ? (
                        <Badge tone="good">done</Badge>
                      ) : (
                        <Badge tone="warn">{left}</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs leading-relaxed text-ink-faint">
        Reading a statement in never changes your books on its own. Every line
        waits for you to say what it is, and anything you decide can be undone.
      </p>
    </div>
  );
}
