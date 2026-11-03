"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CalendarSync, HelpCircle, Trash2 } from "lucide-react";
import {
  deleteStatement,
  flipStatement,
  swapStatementDates,
  type ActionResult,
} from "@/app/(admin)/admin/bank/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Table";
import type { BankImportRow } from "@/lib/data/types";

/**
 * How the file was read, and the two ways it could have been read wrongly.
 *
 * Both failures here produce a statement that looks completely normal. Dates
 * read the wrong way round shift every line by days, so nothing matches and it
 * seems as though the books are wrong. Signs read backwards turn her income
 * into her costs, and the totals still add up. Neither is discoverable by
 * looking at the page, so when the file itself didn't settle the question this
 * says so in as many words and offers the other reading.
 *
 * The offer disappears once anything has been ticked off, because flipping the
 * amounts underneath decisions already made would turn correct work into
 * nonsense. At that point the honest fix is to start again.
 */
export function StatementCorrections({
  importId,
  reading,
  everythingOpen,
}: {
  importId: string;
  reading: BankImportRow["reading"];
  everythingOpen: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function run(
    action: (fd: FormData) => Promise<ActionResult>,
    then?: () => void,
  ) {
    const fd = new FormData();
    fd.set("importId", importId);
    start(async () => {
      const outcome = await action(fd);
      setResult(outcome);
      if (outcome.ok) {
        then?.();
        router.refresh();
      }
    });
  }

  const unsure =
    reading?.dateWasAmbiguous || reading?.amounts === "all-one-way";

  // When the file was unambiguous there is nothing to warn about, so this
  // collapses to a quiet line rather than a card competing for attention.
  if (!unsure) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-tan/25 bg-cream px-5 py-3">
        <p className="text-xs text-ink-faint">
          {reading
            ? `Read using the "${reading.columns.date}" and "${reading.columns.amount}" columns. Dates and amounts were unambiguous.`
            : "No notes were kept on how this file was read."}
        </p>
        <DeleteButton
          confirming={confirming}
          setConfirming={setConfirming}
          pending={pending}
          onDelete={() => run(deleteStatement, () => router.push("/admin/bank"))}
        />
        {result && <Message result={result} />}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Two things this file didn't tell me"
        description="Worth thirty seconds now. Both are invisible later."
        tone="warn"
      />

      <div className="space-y-4 px-5 py-5">
        {reading?.dateWasAmbiguous && (
          <div>
            <p className="flex items-start gap-2 text-sm text-ink">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-bark" aria-hidden />
              <span>
                Every date in this file could be read either way round — the
                third of November, or the eleventh of March. I&rsquo;ve read
                them as{" "}
                <strong>
                  {reading.dateOrder === "day-first"
                    ? "day first (3/11 = 3 November)"
                    : "month first (3/11 = 11 March)"}
                </strong>
                .
              </span>
            </p>
            {everythingOpen && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={pending}
                className="mt-2"
                onClick={() => run(swapStatementDates)}
              >
                <CalendarSync className="h-3.5 w-3.5" aria-hidden />
                No — read them the other way round
              </Button>
            )}
          </div>
        )}

        {reading?.amounts === "all-one-way" && (
          <div>
            <p className="flex items-start gap-2 text-sm text-ink">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-bark" aria-hidden />
              <span>
                Every amount in this file has the same sign, so it never said
                which way the money went. I&rsquo;ve taken them as written.
                Check one line you recognise — if a cost is showing as money
                coming in, turn them round.
              </span>
            </p>
            {everythingOpen && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={pending}
                className="mt-2"
                onClick={() => run(flipStatement)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                Turn every amount round
              </Button>
            )}
          </div>
        )}

        {!everythingOpen && (
          <p className="text-xs text-ink-faint">
            You&rsquo;ve already ticked some of these off, so I can&rsquo;t
            change them underneath you. If the file was read wrongly, delete it
            and read it in again.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-tan/20 pt-4">
          <DeleteButton
            confirming={confirming}
            setConfirming={setConfirming}
            pending={pending}
            onDelete={() => run(deleteStatement, () => router.push("/admin/bank"))}
          />
          {result && <Message result={result} />}
        </div>
      </div>
    </Card>
  );
}

function DeleteButton({
  confirming,
  setConfirming,
  pending,
  onDelete,
}: {
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  pending: boolean;
  onDelete: () => void;
}) {
  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete this statement
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
      This removes the statement and every decision you made on it. Costs you
      recorded from it stay on your books.
      <Button size="sm" variant="danger" type="button" disabled={pending} onClick={onDelete}>
        Delete it
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </span>
  );
}

function Message({ result }: { result: ActionResult }) {
  return (
    <p
      role="status"
      className={`text-sm ${result.ok ? "text-olive" : "text-burgundy"}`}
    >
      {result.message}
    </p>
  );
}
