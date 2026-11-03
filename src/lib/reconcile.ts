/**
 * Reading a bank statement, and working out which of its lines we already
 * know about.
 *
 * The job this does by hand today is the one nobody enjoys: a statement on one
 * side, the app on the other, and a pencil. It is also the job that catches the
 * things nothing else catches — a rent payment that never arrived, a direct
 * debit nobody remembers setting up, a cheque cashed twice.
 *
 * Two rules shape everything here.
 *
 * **An amount must match to the cent.** Near-enough is not a match, it is a
 * guess, and a guess about money is worse than an honest blank. Where nothing
 * matches exactly, the close ones are offered as *near misses* — clearly
 * labelled as such — because a three-dollar gap is usually a bank fee and
 * seeing it is the whole point.
 *
 * **Nothing is ever decided here.** This produces a proposal. Every match is
 * confirmed by a person before it is written down, because the cost of a wrong
 * automatic match is a book that looks balanced and isn't.
 */

// A payment can clear days after it was recorded: an e-transfer lands next
// morning, a cheque can sit for a week. Wider than this and unrelated
// same-amount transactions start colliding — two $1,200 rents a month apart.
const DAYS_EITHER_SIDE = 6;

// How far off an amount can be and still be worth showing as a near miss.
// Roughly: a bank fee, a Stripe fee, a transposed cent — not a different
// transaction.
const NEAR_MISS_CENTS = 2_500;

/** One line from the bank's file. */
export type BankLine = {
  /** Which row of the file it came from, so she can find it again. */
  line: number;
  /** ISO `yyyy-mm-dd`. */
  date: string;
  description: string;
  /** Positive is money into the account, negative is money out. */
  amountCents: number;
};

/** Something already recorded in the app, that a bank line might be. */
export type KnownEntry = {
  kind: "payment" | "expense";
  id: string;
  /** ISO `yyyy-mm-dd` — when we think it happened. */
  date: string;
  /** What to call it on screen: "Rent — Sarah Kemp", "Fortis Alberta". */
  label: string;
  /** Positive into the account, negative out, same as a bank line. */
  amountCents: number;
  /** Already ticked off against an earlier statement. */
  settled?: boolean;
};

export type Candidate = {
  entry: KnownEntry;
  /** Days between the bank's date and ours; negative means ours is later. */
  dayGap: number;
  /** Zero for a real match. Non-zero means this is a near miss. */
  centGap: number;
  /** Higher is better. Only meaningful for ranking within one line. */
  score: number;
};

export type LineResult = {
  bank: BankLine;
  /**
   * - `one` — exactly one thing it can be. Safe to tick.
   * - `several` — more than one equally good answer. Needs a person.
   * - `near` — nothing matches to the cent, but something is close.
   * - `none` — we have no record of this at all.
   */
  verdict: "one" | "several" | "near" | "none";
  /** Best first. Empty when the verdict is `none`. */
  candidates: Candidate[];
};

export type Reconciliation = {
  results: LineResult[];
  /** Things we have a record of that the statement never mentions. */
  missing: KnownEntry[];
  totals: {
    lines: number;
    moneyInCents: number;
    moneyOutCents: number;
    /** Lines with exactly one answer. */
    settled: number;
    /** Lines needing a decision — `several`, `near` or `none`. */
    open: number;
  };
};

/* -------------------------------------------------------------------------- */
/*  Matching                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Words worth comparing. Bank descriptions are mostly noise — reference
 * numbers, branch codes, the word TRANSFER four times — so anything short or
 * purely numeric is dropped and what remains is usually the name of a person
 * or a company, which is the part that identifies it.
 */
function words(text: string): Set<string> {
  const stop = new Set([
    "the", "and", "for", "from", "inc", "ltd", "corp", "payment", "transfer",
    "deposit", "withdrawal", "purchase", "debit", "credit", "cheque", "check",
    "etransfer", "eft", "pos", "bill", "online", "banking", "interac", "ca",
    "canada", "alberta", "misc", "transaction", "ref", "reference",
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !stop.has(w)),
  );
}

function wordOverlap(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const w of left) if (right.has(w)) shared += 1;

  return shared / Math.min(left.size, right.size);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Score one possible answer for one bank line.
 *
 * Date closeness dominates, because the amount has already had to match
 * exactly to get this far and the name is unreliable — a bank will happily
 * describe a rent payment as "MB-CREDIT MEMO". The name is a tie-breaker, not
 * evidence.
 */
function scoreOf(bank: BankLine, entry: KnownEntry): number {
  const gap = Math.abs(daysBetween(bank.date, entry.date));
  const closeness = 1 - gap / (DAYS_EITHER_SIDE + 1);
  const centGap = Math.abs(bank.amountCents - entry.amountCents);

  return (
    closeness * 10 +
    wordOverlap(bank.description, entry.label) * 4 +
    (centGap === 0 ? 20 : 0) +
    (entry.settled ? -30 : 0)
  );
}

function candidatesFor(bank: BankLine, pool: KnownEntry[]): Candidate[] {
  const sameDirection = pool.filter(
    (e) => e.amountCents < 0 === bank.amountCents < 0,
  );

  return sameDirection
    .map((entry) => ({
      entry,
      dayGap: daysBetween(bank.date, entry.date),
      centGap: bank.amountCents - entry.amountCents,
      score: scoreOf(bank, entry),
    }))
    .filter(
      (c) =>
        Math.abs(c.dayGap) <= DAYS_EITHER_SIDE &&
        Math.abs(c.centGap) <= NEAR_MISS_CENTS,
    )
    .sort((a, b) => b.score - a.score);
}

/**
 * Line up a statement against what we already know.
 *
 * Assignment happens in two passes. The first takes only the lines with a
 * single possible answer and claims those records, because a forced match is
 * the most reliable information in the file and letting an ambiguous line take
 * a record first can leave the forced one with nothing. The second pass works
 * through what is left, best score first.
 *
 * A record is claimed by at most one bank line. Two $1,200 rents in the same
 * week are a real situation, and both must find their own row rather than
 * agreeing on one.
 */
export function reconcile(
  lines: BankLine[],
  known: KnownEntry[],
): Reconciliation {
  const key = (e: KnownEntry) => `${e.kind}:${e.id}`;

  const options = new Map<number, Candidate[]>();
  for (const line of lines) options.set(line.line, candidatesFor(line, known));

  const exactFor = (line: BankLine) =>
    (options.get(line.line) ?? []).filter((c) => c.centGap === 0);

  /** Record → the bank line that has claimed it. */
  const claimedBy = new Map<string, number>();
  const lineHasClaim = new Set<number>();

  function claim(line: BankLine, c: Candidate) {
    claimedBy.set(key(c.entry), line.line);
    lineHasClaim.add(line.line);
  }

  // First pass: lines with only one thing they can possibly be. A forced match
  // is the strongest information in the file, and if an ambiguous line is
  // allowed to take that record first the forced line is left with nothing.
  for (const line of lines) {
    const exact = exactFor(line);
    if (exact.length === 1 && !claimedBy.has(key(exact[0].entry))) {
      claim(line, exact[0]);
    }
  }

  // Second pass: every remaining pairing, strongest first, taking whatever is
  // still free. This is what separates two identical rents in the same week —
  // each ends up on its own record rather than both agreeing on one.
  const pairings = lines
    .filter((l) => !lineHasClaim.has(l.line))
    .flatMap((line) => exactFor(line).map((c) => ({ line, c })))
    .sort((a, b) => b.c.score - a.c.score);

  for (const { line, c } of pairings) {
    if (lineHasClaim.has(line.line)) continue;
    if (claimedBy.has(key(c.entry))) continue;
    claim(line, c);
  }

  const results: LineResult[] = lines.map((bank) => {
    const all = options.get(bank.line) ?? [];

    // What this line could still honestly be: an exact-amount record that is
    // either already its own or not spoken for by anybody else. A record
    // another line has claimed is never offered, so no confirmation she makes
    // here can double-count one.
    const available = all.filter(
      (c) =>
        c.centGap === 0 &&
        (claimedBy.get(key(c.entry)) === bank.line ||
          !claimedBy.has(key(c.entry))),
    );

    if (available.length === 1) {
      return { bank, verdict: "one", candidates: available };
    }
    // More than one answer survives, so the pick would be a coin flip. Better
    // to hand her the choice than to be quietly wrong.
    if (available.length > 1) {
      return { bank, verdict: "several", candidates: available };
    }

    const near = all.filter((c) => c.centGap !== 0).slice(0, 3);
    if (near.length > 0) return { bank, verdict: "near", candidates: near };

    return { bank, verdict: "none", candidates: [] };
  });

  const missing = known.filter((e) => !e.settled && !claimedBy.has(key(e)));

  const moneyInCents = lines
    .filter((l) => l.amountCents > 0)
    .reduce((sum, l) => sum + l.amountCents, 0);
  const moneyOutCents = lines
    .filter((l) => l.amountCents < 0)
    .reduce((sum, l) => sum + l.amountCents, 0);

  return {
    results,
    missing,
    totals: {
      lines: lines.length,
      moneyInCents,
      moneyOutCents,
      settled: results.filter((r) => r.verdict === "one").length,
      open: results.filter((r) => r.verdict !== "one").length,
    },
  };
}
