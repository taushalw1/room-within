/**
 * Known-answer checks for the bank rules and the repeating dates.
 *
 * Both are quiet when wrong. A rule that fires on the wrong direction files a
 * refund as a cost; a date that drifts at the end of a month loses or gains a
 * payment over a year, and the only symptom is a total that is slightly off.
 */
import { ruleFor, suggestMatchText, type Rule } from "../src/lib/bank-rules";
import { nextDue, occurrences, yearlyCents } from "../src/lib/recurring";
import { sampleTrips } from "../src/lib/data/sample-books";

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

const rule = (
  id: string,
  matchText: string,
  direction: "in" | "out",
  category: string | null = "Utilities",
): Rule => ({ id, matchText, direction, category, vendor: null });

console.log("\nBank rules");

const rules: Rule[] = [
  rule("a", "FORTIS", "out"),
  rule("b", "FORTIS ALBERTA GAS", "out", "Heating"),
  rule("c", "KEMP", "in", null),
];

check(
  "matches, ignoring case",
  ruleFor({ description: "fortis alberta", amountCents: -1000 }, rules)?.rule.id,
  "a",
);

check(
  "the more specific rule wins",
  ruleFor({ description: "FORTIS ALBERTA GAS 4410", amountCents: -1000 }, rules)
    ?.rule.id,
  "b",
);

// The one that matters: a refund from the gas company is not another gas bill.
check(
  "a rule for money out never fires on money in",
  ruleFor({ description: "FORTIS ALBERTA REFUND", amountCents: 1000 }, rules),
  null,
);

check(
  "and the other way round",
  ruleFor({ description: "KEMP S", amountCents: -1000 }, rules),
  null,
);

check(
  "a rule for money in fires on money in",
  ruleFor({ description: "ETRANSFER KEMP S", amountCents: 120_000 }, rules)?.rule.id,
  "c",
);

check(
  "no rule, no match",
  ruleFor({ description: "SOMETHING ELSE", amountCents: -1000 }, rules),
  null,
);

check(
  "strength is the length matched",
  ruleFor({ description: "FORTIS ALBERTA GAS", amountCents: -1000 }, rules)?.strength,
  18,
);

{
  // Two rules of identical length must still give the same answer every load,
  // not whichever row the database happened to return first.
  const tied: Rule[] = [rule("zzz", "ABCD", "out"), rule("aaa", "WXYZ", "out")];
  const first = ruleFor({ description: "ABCD WXYZ", amountCents: -1 }, tied);
  const second = ruleFor(
    { description: "ABCD WXYZ", amountCents: -1 },
    [...tied].reverse(),
  );
  check("a tie is broken the same way both times", first?.rule.id, second?.rule.id);
}

console.log("\nSuggesting a rule from a bank line");

check("strips the bank's verbs", suggestMatchText("PRE-AUTH DEBIT FORTIS ALBERTA"), "FORTIS ALBERTA");
// "POS" and "PURCHASE" are the bank's own words, "4410" has no letters, and
// "CO" and "OP" are each under three characters — so the only thing left that
// identifies anybody is the town.
check("drops the reference number", suggestMatchText("POS PURCHASE 4410 CO-OP TABER"), "TABER");
check("nothing usable", suggestMatchText("884102"), "");

console.log("\nRepeating dates");

check("a plain month", nextDue("2026-01-15", "monthly"), "2026-02-15");
check("across a year end", nextDue("2026-12-15", "monthly"), "2027-01-15");
check("three months", nextDue("2026-01-15", "quarterly"), "2026-04-15");
check("a year", nextDue("2026-01-15", "yearly"), "2027-01-15");
check("a leap year", nextDue("2024-02-29", "yearly"), "2025-02-28");

// The month-end case. January the 31st has no obvious answer, and the wrong
// one drifts for ever.
check("the 31st into February", nextDue("2026-01-31", "monthly"), "2026-02-28");
check(
  "and back out again, because the anchor is kept",
  nextDue("2026-02-28", "monthly", 31),
  "2026-03-31",
);
check(
  "without the anchor it stays clamped",
  nextDue("2026-02-28", "monthly"),
  "2026-03-28",
);

console.log("\nA year of a monthly bill on the 31st");
{
  const dates = occurrences("2026-01-31", "monthly", "2026-12-31");
  check("twelve of them", dates.length, 12);
  check("February clamps", dates[1], "2026-02-28");
  check("March goes back to the 31st", dates[2], "2026-03-31");
  check("April has thirty days", dates[3], "2026-04-30");
  check("May back to the 31st", dates[4], "2026-05-31");
  check("December", dates[11], "2026-12-31");
}

console.log("\nBounds");
{
  const dates = occurrences("2026-01-01", "monthly", "2099-01-01");
  check("a careless span is capped", dates.length, 60);
}
{
  const dates = occurrences("2026-06-01", "monthly", "2026-01-01");
  check("an end before the start gives nothing", dates.length, 0);
}

console.log("\nWhat it costs in a year");
check("monthly", yearlyCents(10_000, "monthly"), 120_000);
check("quarterly", yearlyCents(10_000, "quarterly"), 40_000);
check("yearly", yearlyCents(10_000, "yearly"), 10_000);

console.log("\nSample trips agree with the formula the database uses");
{
  // `amount_cents` is a generated column: round(kilometres * rate_cents_per_km).
  // The sample has to obey the same rule, or the demo shows figures the real
  // app would never produce — which is how a rate stored as 7000 instead of
  // 70 went unnoticed until it was on screen.
  for (const trip of sampleTrips) {
    check(
      `${trip.purpose.slice(0, 28)}`,
      trip.amount_cents,
      Math.round(Number(trip.kilometres) * trip.rate_cents_per_km),
    );
  }
  check(
    "and the rate is cents, not dollars",
    sampleTrips.every((t) => t.rate_cents_per_km > 0 && t.rate_cents_per_km < 500),
    true,
  );
}

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll bank-rule and repeating-date checks passed.\n");
