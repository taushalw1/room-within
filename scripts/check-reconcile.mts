/**
 * Known-answer checks for reading a bank file and matching it.
 *
 * Both halves of this fail silently in the worst possible way. A misread date
 * column shifts every line by days and quietly breaks the matching; a flipped
 * sign turns income into costs; a wrong match produces a book that balances
 * and is wrong. None of it shows up in a build, and none of it is obvious on
 * screen, so every case below has an answer worked out by hand.
 *
 * The bank files are the real shapes — RBC's `CAD$` heading, a debit/credit
 * pair with a running balance beside it, a preamble above the headings — not
 * tidied-up inventions.
 */
import { readBankFile, moneyCells } from "../src/lib/bank-csv";
import { reconcile, type KnownEntry } from "../src/lib/reconcile";

let failures = 0;

function check(what: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    console.log(`  ok    ${what}`);
  } else {
    console.log(`  FAIL  ${what}\n          got  ${a}\n          want ${b}`);
    failures += 1;
  }
}

/* ========================================================================== */
console.log("\nAmounts");
/* ========================================================================== */

check("plain", moneyCells("1200.00"), 120_000);
check("thousands separator", moneyCells("$1,200.00"), 120_000);
check("brackets are negative", moneyCells("(45.60)"), -4_560);
check("minus sign", moneyCells("-45.60"), -4_560);
check("unicode minus", moneyCells("−4.50"), -450);
check("DR is negative", moneyCells("45.60 DR"), -4_560);
check("CR is positive", moneyCells("45.60 CR"), 4_560);
check("whole number", moneyCells("1200"), 120_000);
check("third decimal rounds", moneyCells("10.555"), 1_056);
check("blank is nothing", moneyCells("   "), null);
check("words are nothing", moneyCells("Rent"), null);
// 0.1 + 0.2 territory: 8.07 * 100 is 806.9999... in binary floating point.
check("no lost cent", moneyCells("8.07"), 807);

/* ========================================================================== */
console.log("\nRBC chequing export");
/* ========================================================================== */
{
  const file = `"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"
"Chequing","00001-1234567","11/1/2026","","e-Transfer received, KEMP S","","1200.00",""
"Chequing","00001-1234567","11/14/2026","","FORTIS ALBERTA","","-182.40",""
"Chequing","00001-1234567","11/20/2026","101","Cheque","ROOF REPAIR","-2500.00",""`;

  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("found the amount column", read.reading.columns.amount, "CAD$");
    check("rows read", read.rows.length, 3);
    // 11/14 can only be month-first, which settles the whole column — so
    // 11/1 is 1 November, not 11 January.
    check("date order", read.reading.dateOrder, "month-first");
    check("not ambiguous", read.reading.dateWasAmbiguous, false);
    check("first date", read.rows[0].date, "2026-11-01");
    check("second date", read.rows[1].date, "2026-11-14");
    check("money in", read.rows[0].amountCents, 120_000);
    check("money out", read.rows[1].amountCents, -18_240);
    check("signs seen both ways", read.reading.amounts, "signed");
    check("row number kept", read.rows[0].line, 2);
  }
}

/* ========================================================================== */
console.log("\nDebit and credit columns, with a balance beside them");
/* ========================================================================== */
{
  const file = `Date,Description,Debit,Credit,Balance
03/11/2026,RENT - A OKONKWO,,950.00,4150.00
17/11/2026,ATCO GAS,214.88,,3935.12
28/11/2026,TOWN OF GRASSY LAKE UTILITIES,96.50,,3838.62`;

  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("pair detected", read.reading.amounts, "debit-and-credit");
    // 17 and 28 can only be days, so the column is day-first.
    check("date order", read.reading.dateOrder, "day-first");
    check("not ambiguous", read.reading.dateWasAmbiguous, false);
    check("day-first date", read.rows[0].date, "2026-11-03");
    check("credit is positive", read.rows[0].amountCents, 95_000);
    check("debit is negative", read.rows[1].amountCents, -21_488);
    check("balance ignored", read.rows[2].amountCents, -9_650);
  }
}

/* ========================================================================== */
console.log("\nA balance column must never be read as the amount");
/* ========================================================================== */
{
  // No heading the word lists recognise, so the amount is found by looking at
  // the values — and the balance column reads as money just as well.
  const file = `When,What,Movement,Running Balance
2026-11-03,RENT,950.00,4150.00
2026-11-17,GAS,-214.88,3935.12`;

  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("chose Movement", read.reading.columns.amount, "Movement");
    check("first amount", read.rows[0].amountCents, 95_000);
    check("second amount", read.rows[1].amountCents, -21_488);
  }
}

/* ========================================================================== */
console.log("\nPreamble above the headings");
/* ========================================================================== */
{
  const file = `ROOM WITHIN COMMUNITY
Account 00001-1234567
Statement period: 01 Nov 2026 to 30 Nov 2026

Posting Date,Details,Amount
01 Nov 2026,RENT KEMP,1200.00
15 Nov 2026,INSURANCE,-340.00`;

  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("rows read", read.rows.length, 2);
    check("spelled month", read.rows[0].date, "2026-11-01");
    check("row number is the real one", read.rows[0].line, 6);
  }
}

/* ========================================================================== */
console.log("\nThings that cannot be guessed are flagged, not guessed");
/* ========================================================================== */
{
  // Every date could be read either way round.
  const file = `Date,Description,Amount
01/02/2026,RENT,1200.00
03/04/2026,RENT,1200.00`;

  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("ambiguity admitted", read.reading.dateWasAmbiguous, true);
  }
}
{
  // Every amount is positive, so the file never says which way money went.
  const file = `Date,Description,Amount
2026-11-03,RENT,1200.00
2026-11-17,ATCO GAS,214.88`;

  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("direction admitted", read.reading.amounts, "all-one-way");
  }
}

/* ========================================================================== */
console.log("\nFiles that cannot be read say so");
/* ========================================================================== */
{
  const read = readBankFile("just one line");
  check("too short", "error" in read, true);
}
{
  const read = readBankFile("Name,Email\nSarah,s@example.com\nAdeola,a@example.com");
  check("not a statement", "error" in read, true);
}
{
  const read = readBankFile("Date,Description,Amount\nnot a date,RENT,oops");
  check("no readable rows", "error" in read, true);
}
{
  const file = `Date,Description,Amount
2026-11-03,RENT,1200.00
oops,BROKEN,99.00
2026-11-05,,0.00`;
  const read = readBankFile(file);
  if ("error" in read) {
    check("read the file", read.error, "no error");
  } else {
    check("good row kept", read.rows.length, 1);
    check("bad rows explained", read.skipped.length, 2);
    check("reason given", read.skipped[0].reason, "no date I could read");
    check("zero explained", read.skipped[1].reason, "the amount was zero");
  }
}

/* ========================================================================== */
console.log("\nMatching");
/* ========================================================================== */

const line = (n: number, date: string, description: string, cents: number) => ({
  line: n,
  date,
  description,
  amountCents: cents,
});

{
  const known: KnownEntry[] = [
    { kind: "payment", id: "p1", date: "2026-11-01", label: "Rent — Sarah Kemp", amountCents: 120_000 },
    { kind: "expense", id: "e1", date: "2026-11-14", label: "Fortis Alberta", amountCents: -18_240 },
  ];

  const r = reconcile(
    [
      line(2, "2026-11-01", "e-Transfer received, KEMP S", 120_000),
      line(3, "2026-11-14", "FORTIS ALBERTA", -18_240),
    ],
    known,
  );

  check("both matched", r.results.map((x) => x.verdict), ["one", "one"]);
  check("matched the payment", r.results[0].candidates[0].entry.id, "p1");
  check("matched the expense", r.results[1].candidates[0].entry.id, "e1");
  check("nothing missing", r.missing.length, 0);
  check("settled count", r.totals.settled, 2);
  check("money in", r.totals.moneyInCents, 120_000);
  check("money out", r.totals.moneyOutCents, -18_240);
}

{
  // The cheque was written on the 20th and cashed on the 24th.
  const known: KnownEntry[] = [
    { kind: "expense", id: "e1", date: "2026-11-20", label: "Roof repair", amountCents: -250_000 },
  ];
  const r = reconcile([line(2, "2026-11-24", "CHEQUE 101", -250_000)], known);
  check("four days late still matches", r.results[0].verdict, "one");
  check("gap recorded", r.results[0].candidates[0].dayGap, 4);
}

{
  // Three weeks apart is a different transaction, not a late one.
  const known: KnownEntry[] = [
    { kind: "expense", id: "e1", date: "2026-11-01", label: "Roof repair", amountCents: -250_000 },
  ];
  const r = reconcile([line(2, "2026-11-22", "CHEQUE 101", -250_000)], known);
  check("outside the window", r.results[0].verdict, "none");
  check("reported as missing", r.missing.map((m) => m.id), ["e1"]);
}

{
  // Two tenants, same rent, same week. Each must find its own record.
  const known: KnownEntry[] = [
    { kind: "payment", id: "kemp", date: "2026-11-01", label: "Rent — Sarah Kemp", amountCents: 120_000 },
    { kind: "payment", id: "okonkwo", date: "2026-11-03", label: "Rent — Adeola Okonkwo", amountCents: 120_000 },
  ];

  const r = reconcile(
    [
      line(2, "2026-11-01", "ETRANSFER KEMP", 120_000),
      line(3, "2026-11-03", "ETRANSFER OKONKWO", 120_000),
    ],
    known,
  );

  check("both resolved", r.results.map((x) => x.verdict), ["one", "one"]);
  check("first is Kemp", r.results[0].candidates[0].entry.id, "kemp");
  check("second is Okonkwo", r.results[1].candidates[0].entry.id, "okonkwo");
  check("neither left over", r.missing.length, 0);
}

{
  // Same again, but the bank gave no useful names at all. The dates are the
  // only evidence, and they are enough.
  const known: KnownEntry[] = [
    { kind: "payment", id: "kemp", date: "2026-11-01", label: "Rent — Sarah Kemp", amountCents: 120_000 },
    { kind: "payment", id: "okonkwo", date: "2026-11-05", label: "Rent — Adeola Okonkwo", amountCents: 120_000 },
  ];

  const r = reconcile(
    [
      line(2, "2026-11-01", "MB-CREDIT MEMO", 120_000),
      line(3, "2026-11-05", "MB-CREDIT MEMO", 120_000),
    ],
    known,
  );

  check("split on dates alone", r.results.map((x) => x.candidates[0].entry.id), ["kemp", "okonkwo"]);
  check("neither left over", r.missing.length, 0);
}

{
  // One bank line, two records that both fit. A coin flip is not an answer.
  const known: KnownEntry[] = [
    { kind: "expense", id: "a", date: "2026-11-10", label: "Hardware store", amountCents: -4_500 },
    { kind: "expense", id: "b", date: "2026-11-10", label: "Paint", amountCents: -4_500 },
  ];
  const r = reconcile([line(2, "2026-11-10", "POS PURCHASE", -4_500)], known);
  check("asks rather than guesses", r.results[0].verdict, "several");
  check("offers both", r.results[0].candidates.length, 2);
}

{
  // Stripe took its fee. Nothing matches to the cent, and the gap is the point.
  const known: KnownEntry[] = [
    { kind: "payment", id: "p1", date: "2026-11-02", label: "Booking — hall", amountCents: 20_000 },
  ];
  const r = reconcile([line(2, "2026-11-02", "STRIPE PAYOUT", 19_410)], known);
  check("near miss, not a match", r.results[0].verdict, "near");
  check("shortfall shown", r.results[0].candidates[0].centGap, -590);
}

{
  // Money coming in is never one of her costs, however well the amount fits.
  const known: KnownEntry[] = [
    { kind: "expense", id: "e1", date: "2026-11-02", label: "Insurance", amountCents: -34_000 },
  ];
  const r = reconcile([line(2, "2026-11-02", "REFUND", 34_000)], known);
  check("direction respected", r.results[0].verdict, "none");
}

{
  // Already ticked off against last month's statement, so it must not be
  // offered again as though it were news.
  const known: KnownEntry[] = [
    { kind: "payment", id: "p1", date: "2026-11-01", label: "Rent — Kemp", amountCents: 120_000, settled: true },
  ];
  const r = reconcile([], known);
  check("settled is not missing", r.missing.length, 0);
}

{
  const known: KnownEntry[] = [
    { kind: "payment", id: "p1", date: "2026-11-01", label: "Rent — Kemp", amountCents: 120_000 },
  ];
  const r = reconcile([line(2, "2026-11-01", "UNKNOWN DEPOSIT", 55_000)], known);
  check("unknown line", r.results[0].verdict, "none");
  check("and the record is missing", r.missing.map((m) => m.id), ["p1"]);
  check("open count", r.totals.open, 1);
}

/* ========================================================================== */
if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll reconciliation checks passed.\n");
