/**
 * Reading whatever file the bank gave her.
 *
 * There is no standard for this. Every bank exports a different shape, and
 * several export a shape that changes when they redesign their website. So
 * nothing here is hard-coded to one bank: the columns are found by what their
 * headings mean, and the two things that genuinely cannot be guessed from a
 * single row — which way round the date is, and which sign means money leaving
 * — are worked out by looking down the whole column.
 *
 * Where they still can't be settled, that is said out loud rather than
 * guessed. A silently misread date column shifts every line by days and
 * quietly breaks every match; a silently flipped sign turns her income into
 * her costs. Both are worse than a question.
 */

export type BankFile = {
  rows: ParsedRow[];
  /** Rows that could not be read, kept so nothing vanishes unexplained. */
  skipped: { line: number; text: string; reason: string }[];
  /** What was worked out about the file, to show her in plain words. */
  reading: {
    dateOrder: "day-first" | "month-first" | "year-first";
    /** True when the dates could be read either way round. */
    dateWasAmbiguous: boolean;
    /** How the amounts were understood. */
    amounts: "signed" | "debit-and-credit" | "all-one-way";
    columns: { date: string; description: string; amount: string };
  };
};

export type ParsedRow = {
  line: number;
  date: string;
  description: string;
  amountCents: number;
};

/* -------------------------------------------------------------------------- */
/*  Splitting the file into cells                                             */
/* -------------------------------------------------------------------------- */

/**
 * One line of CSV into its cells, respecting quotes.
 *
 * Written out rather than split on commas because a description is exactly the
 * place a comma turns up — "SMITH, J — RENT" is one cell, not two, and getting
 * that wrong shifts the amount into the description column.
 */
function cells(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (quoted) {
      if (ch === '"') {
        // A doubled quote inside a quoted cell is one literal quote.
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cell.trim());
      cell = "";
    } else cell += ch;
  }

  out.push(cell.trim());
  return out;
}

/**
 * A line of the file, with the row number it actually has in the file.
 *
 * Blank lines are dropped before anything else looks at the file, but their
 * numbers are not: when a row can't be read she is told which row, and that
 * number has to match what she sees when she opens the file herself. Banks put
 * a blank line above the headings often enough that counting from the filtered
 * list is wrong by one on most real statements.
 */
type Row = { no: number; text: string };

/** Whichever of comma, semicolon or tab appears most consistently. */
function sniffDelimiter(rows: Row[]): string {
  const counts = [",", ";", "\t"].map((d) => ({
    d,
    n: rows.slice(0, 20).reduce((sum, r) => sum + cells(r.text, d).length - 1, 0),
  }));

  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

/* -------------------------------------------------------------------------- */
/*  Finding the columns                                                       */
/* -------------------------------------------------------------------------- */

const DATE_WORDS = /\b(date|posted|posting|when|day)\b/i;
const DESC_WORDS =
  /\b(desc|description|details?|narrative|memo|payee|particulars?|merchant|name|transaction)\b/i;
// `CAD$` is RBC's name for the amount column, so a currency marker counts as
// one too.
const AMOUNT_WORDS = /\b(amount|value|sum|total)\b|\b(cad|usd)\b|\$/i;
const DEBIT_WORDS = /\b(debit|withdrawal|withdrawn|paid\s*out|money\s*out|out)\b/i;
const CREDIT_WORDS = /\b(credit|deposit|paid\s*in|money\s*in|in)\b/i;

// A running balance is a column of money that is never a transaction. Picking
// it as the amount produces a file that reads perfectly and is entirely wrong,
// so it is excluded by name before anything else looks at the values.
const BALANCE_WORDS = /\b(balance|bal|running)\b/i;

/**
 * Which column is the amount, judged by its contents rather than its heading.
 *
 * A date column also parses as money once the slashes are stripped, and a
 * running balance parses perfectly, so both are ruled out first. Of what
 * remains, the money column is the one that reads as an amount on nearly every
 * row — a description column manages it on almost none.
 */
function guessAmountByValue(
  rows: Row[],
  headerIndex: number,
  delimiter: string,
  head: string[],
  dateColumn: number,
): number {
  const sample = rows
    .slice(headerIndex + 1, headerIndex + 26)
    .map((r) => cells(r.text, delimiter));

  if (sample.length === 0) return -1;

  let best = -1;
  let bestRate = 0;

  for (let c = 0; c < head.length; c += 1) {
    // Dates and balances are both columns of plausible-looking money. Both are
    // ruled out by their headings rather than by their contents: a date is
    // rejected by `moneyCells` anyway, because its separators survive the
    // stripping, but a second date column headed "Posted" would otherwise be
    // weighed on nothing.
    if (
      c === dateColumn ||
      BALANCE_WORDS.test(head[c] ?? "") ||
      DATE_WORDS.test(head[c] ?? "")
    ) {
      continue;
    }

    let money = 0;
    let filled = 0;

    for (const row of sample) {
      const cell = (row[c] ?? "").trim();
      if (!cell) continue;
      filled += 1;
      if (moneyCells(cell) !== null) money += 1;
    }

    const rate = filled === 0 ? 0 : money / filled;
    if (rate > bestRate) {
      bestRate = rate;
      best = c;
    }
  }

  // Short of near-unanimous, this is a guess rather than a reading.
  return bestRate >= 0.8 ? best : -1;
}

/**
 * Which column holds the date, judged by its contents.
 *
 * The same reasoning as the amount: there will always be another bank with
 * another word for it, and what is in the column is more reliable than what it
 * is called. Declared after `dateParts` is defined, which is why this sits
 * here rather than beside its amount twin.
 */
function guessDateByValue(
  rows: Row[],
  headerIndex: number,
  delimiter: string,
  columnCount: number,
): number {
  const sample = rows
    .slice(headerIndex + 1, headerIndex + 26)
    .map((r) => cells(r.text, delimiter));

  if (sample.length === 0) return -1;

  for (let c = 0; c < columnCount; c += 1) {
    let dates = 0;
    let filled = 0;

    for (const row of sample) {
      const cell = (row[c] ?? "").trim();
      if (!cell) continue;
      filled += 1;
      if (dateParts(cell) !== null) dates += 1;
    }

    // The first column that is nearly all dates. Statements rarely carry two.
    if (filled > 0 && dates / filled >= 0.8) return c;
  }

  return -1;
}

type Columns = {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  /** Index into the filtered rows, not a file line number. */
  headerIndex: number;
  names: { date: string; description: string; amount: string };
};

/**
 * Find the heading row and what each column is.
 *
 * The heading is often not the first line — banks like to put the account
 * number, the date range and a blank line above it — so the first twenty rows
 * are tried and the one that looks most like a heading wins.
 */
function findColumns(rows: Row[], delimiter: string): Columns | null {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const head = cells(rows[i].text, delimiter);
    if (head.length < 2) continue;

    const find = (re: RegExp) => head.findIndex((h) => re.test(h));

    const findSafe = (re: RegExp) =>
      head.findIndex((h) => re.test(h) && !BALANCE_WORDS.test(h));

    let date = find(DATE_WORDS);
    if (date === -1) date = guessDateByValue(rows, i, delimiter, head.length);

    const debit = findSafe(DEBIT_WORDS);
    const credit = findSafe(CREDIT_WORDS);
    let amount = findSafe(AMOUNT_WORDS);

    // "Amount" and "Debit" can both be present; the signed single column wins
    // only if there is no pair.
    if (amount !== -1 && amount === debit) amount = -1;

    // Some banks name the amount column something no list will ever contain.
    // Rather than grow the list for ever, the columns are judged on what is
    // in them: the one that reads as money on nearly every row, is not the
    // date, and is not a balance.
    if (amount === -1 && !(debit !== -1 && credit !== -1)) {
      amount = guessAmountByValue(rows, i, delimiter, head, date);
    }

    const hasMoney = amount !== -1 || (debit !== -1 && credit !== -1);
    if (date === -1 || !hasMoney) continue;

    // The description is whichever text column is left; it is the one heading
    // banks are least consistent about, so an unmatched spare column will do.
    let description = head.findIndex(
      (h, idx) =>
        DESC_WORDS.test(h) &&
        idx !== date &&
        idx !== amount &&
        idx !== debit &&
        idx !== credit,
    );

    if (description === -1) {
      description = head.findIndex(
        (_, idx) =>
          idx !== date && idx !== amount && idx !== debit && idx !== credit,
      );
    }

    return {
      date,
      description,
      amount,
      debit,
      credit,
      headerIndex: i,
      names: {
        date: head[date] || "date",
        description: description === -1 ? "—" : head[description] || "details",
        amount:
          amount !== -1
            ? head[amount] || "amount"
            : `${head[debit] || "out"} / ${head[credit] || "in"}`,
      },
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                     */
/* -------------------------------------------------------------------------- */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

type DateParts = { a: number; b: number; year: number } | { iso: string } | null;

/** Pull a date apart without yet deciding which number is the month. */
function dateParts(text: string): DateParts {
  const t = text.trim();

  // 2026-11-03 — unambiguous, and the only form that needs no guessing.
  const iso = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return { iso: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }

  // 3 Nov 2026 / Nov 3, 2026 / 03-NOV-26 — the month is spelled, so also safe.
  const named = t.match(
    /^(\d{1,2})[\s-]*([A-Za-z]{3,})[\s-]*(\d{2,4})$|^([A-Za-z]{3,})[\s.]*(\d{1,2}),?\s*(\d{2,4})$/,
  );
  if (named) {
    const day = named[1] ?? named[5];
    const monthWord = (named[2] ?? named[4]).slice(0, 3).toLowerCase();
    const yearText = named[3] ?? named[6];
    const month = MONTHS[monthWord];
    if (month && day && yearText) {
      const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
      return {
        iso: `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`,
      };
    }
  }

  // 03/11/2026 — could be either way round. Decided across the column.
  const numeric = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (numeric) {
    const [, a, b, y] = numeric;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return { a: Number(a), b: Number(b), year };
  }

  return null;
}

/**
 * Decide, for the file as a whole, whether numeric dates are day-first.
 *
 * One row can rarely say. A column of them usually can: the moment any row has
 * a first number above twelve it must be a day, and the question is settled
 * for every other row too. Only a file where every single date could be read
 * both ways stays ambiguous — and then it is reported as such, because a month
 * read as a day moves a payment by up to eleven days and breaks the matching
 * silently.
 */
function decideDateOrder(
  values: DateParts[],
): { dayFirst: boolean; ambiguous: boolean } {
  let mustBeDayFirst = false;
  let mustBeMonthFirst = false;

  for (const v of values) {
    if (!v || "iso" in v) continue;
    if (v.a > 12) mustBeDayFirst = true;
    if (v.b > 12) mustBeMonthFirst = true;
  }

  // Both at once means the column is not one consistent format. Month-first is
  // reported, but the ambiguity flag is what she actually sees.
  if (mustBeDayFirst && mustBeMonthFirst) {
    return { dayFirst: false, ambiguous: true };
  }
  if (mustBeDayFirst) return { dayFirst: true, ambiguous: false };
  if (mustBeMonthFirst) return { dayFirst: false, ambiguous: false };

  // Nothing in the column settles it. Canadian bank exports are usually
  // month-first, so that is the assumption — and it is flagged.
  return { dayFirst: false, ambiguous: true };
}

function toIso(parts: DateParts, dayFirst: boolean): string | null {
  if (!parts) return null;
  if ("iso" in parts) return parts.iso;

  const day = dayFirst ? parts.a : parts.b;
  const month = dayFirst ? parts.b : parts.a;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${parts.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*  Amounts                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A cell of money into whole cents.
 *
 * Handles the dressing banks add: currency symbols, thousands separators,
 * brackets for negatives, a trailing CR or DR, and the three different
 * characters that all look like a minus sign.
 */
export function moneyCells(text: string): number | null {
  let t = text.trim().replace(/[−–—]/g, "-");
  if (!t) return null;

  let negative = false;

  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  if (/\bdr\b/i.test(t)) negative = true;
  if (/\bcr\b/i.test(t)) negative = false;

  t = t.replace(/(cr|dr)/gi, "").replace(/[$£€\s,]/g, "");

  if (t.startsWith("-")) {
    negative = true;
    t = t.slice(1);
  }
  if (t.startsWith("+")) t = t.slice(1);

  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;

  // Rounded rather than truncated: 10.555 from a spreadsheet should be 1056,
  // and `Math.round` on the cents keeps a float's last bit from losing a cent.
  const cents = Math.round(Number(t) * 100);
  if (!Number.isFinite(cents)) return null;

  return negative ? -cents : cents;
}

/* -------------------------------------------------------------------------- */
/*  Putting it together                                                       */
/* -------------------------------------------------------------------------- */

export function readBankFile(text: string): BankFile | { error: string } {
  // Numbered before the blanks are dropped, so every row number reported back
  // is the row she will find if she opens the file herself.
  const rows: Row[] = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((text, i) => ({ no: i + 1, text }))
    .filter((r) => r.text.trim() !== "");

  if (rows.length < 2) {
    return { error: "That file looks empty." };
  }

  const delimiter = sniffDelimiter(rows);
  const cols = findColumns(rows, delimiter);

  if (!cols) {
    return {
      error:
        "I couldn't find a date column and an amount column in that file. " +
        "Most banks offer a CSV download — that's the one to use.",
    };
  }

  const body = rows.slice(cols.headerIndex + 1);
  const skipped: BankFile["skipped"] = [];

  // Dates first, so the whole column can decide which way round it reads
  // before any single row is committed to.
  const raw = body.map((row) => ({
    line: row.no,
    text: row.text,
    cs: cells(row.text, delimiter),
  }));

  const dateOrder = decideDateOrder(
    raw.map((r) => dateParts(r.cs[cols.date] ?? "")),
  );

  const parsed: ParsedRow[] = [];
  let sawPositive = false;
  let sawNegative = false;

  for (const r of raw) {
    const date = toIso(dateParts(r.cs[cols.date] ?? ""), dateOrder.dayFirst);
    if (!date) {
      skipped.push({ line: r.line, text: r.text, reason: "no date I could read" });
      continue;
    }

    let amountCents: number | null;

    if (cols.amount !== -1) {
      amountCents = moneyCells(r.cs[cols.amount] ?? "");
    } else {
      // A debit/credit pair. Only one side is ever filled in, and the debit
      // side is money leaving however the bank chose to write it.
      const out = moneyCells(r.cs[cols.debit] ?? "");
      const inn = moneyCells(r.cs[cols.credit] ?? "");
      amountCents =
        out !== null && out !== 0
          ? -Math.abs(out)
          : inn !== null && inn !== 0
            ? Math.abs(inn)
            : null;
    }

    if (amountCents === null) {
      skipped.push({ line: r.line, text: r.text, reason: "no amount I could read" });
      continue;
    }
    if (amountCents === 0) {
      skipped.push({ line: r.line, text: r.text, reason: "the amount was zero" });
      continue;
    }

    if (amountCents > 0) sawPositive = true;
    if (amountCents < 0) sawNegative = true;

    parsed.push({
      line: r.line,
      date,
      description:
        cols.description === -1 ? "" : (r.cs[cols.description] ?? "").trim(),
      amountCents,
    });
  }

  if (parsed.length === 0) {
    return {
      error:
        "I found the columns but couldn't read a single row — the dates or " +
        "the amounts aren't in a form I recognise.",
    };
  }

  const amounts: BankFile["reading"]["amounts"] =
    cols.amount === -1
      ? "debit-and-credit"
      : sawPositive && sawNegative
        ? "signed"
        : "all-one-way";

  return {
    rows: parsed,
    skipped,
    reading: {
      dateOrder: dateOrder.ambiguous
        ? dateOrder.dayFirst
          ? "day-first"
          : "month-first"
        : dateOrder.dayFirst
          ? "day-first"
          : "month-first",
      dateWasAmbiguous: dateOrder.ambiguous,
      amounts,
      columns: cols.names,
    },
  };
}

/** Flip every amount, for a file that turned out to be the other way round. */
export function flipDirection(rows: ParsedRow[]): ParsedRow[] {
  return rows.map((r) => ({ ...r, amountCents: -r.amountCents }));
}
