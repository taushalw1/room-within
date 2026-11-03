/**
 * Known-answer checks for the year-end figures and the file handed over.
 *
 * These numbers go to an accountant, so a quiet error here is one that gets
 * filed. The year filtering, the sign on a cost, and the spreadsheet guarding
 * are all things that look right on screen and are wrong in the file.
 */
import {
  buildYearEnd,
  summaryCsv,
  transactionsCsv,
  type YearEndInput,
} from "../src/lib/year-end";

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

const input: YearEndInput = {
  year: 2026,
  payments: [
    { amountCents: 120_000, paidAt: "2026-01-05T00:00:00Z", kind: "rent" },
    { amountCents: 120_000, paidAt: "2026-02-05T00:00:00Z", kind: "rent" },
    { amountCents: 20_000, paidAt: "2026-03-11T00:00:00Z", kind: "booking" },
    // Just outside the year at each end. Both must be excluded.
    { amountCents: 999_999, paidAt: "2025-12-31T00:00:00Z", kind: "rent" },
    { amountCents: 888_888, paidAt: "2027-01-01T00:00:00Z", kind: "rent" },
  ],
  donations: [
    { amountCents: 5_000, receivedAt: "2026-06-01T00:00:00Z" },
    { amountCents: 777_777, receivedAt: "2025-06-01T00:00:00Z" },
  ],
  expenses: [
    {
      amountCents: 18_240,
      taxCents: 869,
      incurredOn: "2026-02-14",
      category: "Utilities",
      vendor: "Fortis Alberta",
      description: null,
    },
    {
      amountCents: 9_650,
      taxCents: 460,
      incurredOn: "2026-03-28",
      category: "Utilities",
      vendor: "Town of Grassy Lake",
      description: "Water",
    },
    {
      amountCents: 46_504,
      taxCents: 2_215,
      incurredOn: "2026-11-20",
      category: "Repairs",
      vendor: "Hildebrand Roofing",
      description: null,
    },
    {
      amountCents: 555_555,
      taxCents: 0,
      incurredOn: "2025-11-20",
      category: "Repairs",
      vendor: "Last year",
      description: null,
    },
  ],
  gstCollectedCents: 13_000,
  instructorPayouts: [
    { name: "Marguerite Oyelaran", paidCents: 92_000 },
    { name: "Devon Park", paidCents: 41_000 },
  ],
};

const r = buildYearEnd(input);

console.log("\nIncome");
// 120,000 + 120,000 + 20,000 + 5,000 donation
check("total", r.income.totalCents, 265_000);
check("rent grouped", r.income.byStream[0], { label: "Rent", cents: 240_000 });
check("bookings next", r.income.byStream[1], { label: "Room bookings", cents: 20_000 });
check("only two streams", r.income.byStream.length, 2);
check("donations separate", r.income.donationsCents, 5_000);

console.log("\nCosts");
// 18,240 + 9,650 + 46,504
check("total", r.costs.totalCents, 74_394);
check("biggest first", r.costs.byCategory[0].label, "Repairs");
check("utilities grouped", r.costs.byCategory[1], {
  label: "Utilities",
  cents: 27_890,
  taxCents: 1_329,
});

console.log("\nThe bottom line");
check("income less costs", r.netCents, 190_606);

console.log("\nGST");
check("collected", r.gst.collectedCents, 13_000);
// 869 + 460 + 2,215
check("paid", r.gst.paidCents, 3_544);
check("difference", r.gst.netCents, 9_456);
check("under the threshold", r.gst.overThreshold, false);

{
  // $30,000 exactly is over, not under — registration is compulsory at it.
  const big = buildYearEnd({
    ...input,
    payments: [{ amountCents: 3_000_000, paidAt: "2026-05-01T00:00:00Z", kind: "rent" }],
    donations: [],
  });
  check("threshold is inclusive", big.gst.overThreshold, true);
}

console.log("\nT4A");
check("needed above $500", r.t4a[0], {
  name: "Marguerite Oyelaran",
  paidCents: 92_000,
  needed: true,
});
check("not needed below", r.t4a[1].needed, false);

console.log("\nThe transaction file");
{
  const csv = transactionsCsv(input);
  const lines = csv.trimEnd().split("\r\n");

  lines.forEach((l, i) => console.log(`          [${i}] ${l}`));
  check("ends every line with CRLF", csv.endsWith("\r\n"), true);
  check("header plus seven rows", lines.length, 8);
  check(
    "header",
    lines[0],
    "Date,Type,Category,Who,Description,Amount,GST included",
  );
  // Sorted by date across income and costs together.
  check("first row is January", lines[1].startsWith("2026-01-05,Income"), true);
  check("last row is November", lines[7].startsWith("2026-11-20,Cost"), true);
  // A cost is negative, so the column sums to the real position.
  check("cost is negative", lines[7].includes(",-465.04,"), true);
  check("income is positive", lines[1].includes(",1200.00,"), true);
  check("nothing from other years", csv.includes("9999.99"), false);
  check("nothing from other years either", csv.includes("5555.55"), false);
}

console.log("\nA spreadsheet can't be made to run anything");
{
  const nasty = transactionsCsv({
    ...input,
    expenses: [
      {
        amountCents: 1_000,
        taxCents: 0,
        incurredOn: "2026-04-01",
        category: "Repairs",
        // Three separate hazards: a formula, a quote, and a comma.
        vendor: '=cmd|\' /c calc\'!A1',
        description: 'He said "fine", then left',
      },
      {
        amountCents: 1_000,
        taxCents: 0,
        incurredOn: "2026-04-02",
        // A leading minus that really is the start of a formula.
        category: "-1+1",
        vendor: null,
        description: null,
      },
    ],
  });

  check("formula defused", nasty.includes(",'=cmd"), true);
  // A leading minus is on every injection list, but a negative number is not
  // a formula. Guarding one turns the whole Amount column into text that an
  // accountant's spreadsheet will refuse to add up.
  check("hostile minus guarded", nasty.includes(",'-1+1,"), true);
  check("negative number left alone", nasty.includes(",-10.00,"), true);
  check("quotes doubled", nasty.includes('""fine""'), true);
  check("comma kept inside one cell", nasty.includes('"He said ""fine"", then left"'), true);
}

console.log("\nThe summary file");
{
  const csv = summaryCsv(r);
  check("names the basis", csv.includes("cash basis"), true);
  check("says what it is not", csv.includes("not a tax return"), true);
  check("total income", csv.includes("Total income,2650.00"), true);
  check("total costs", csv.includes("Total costs,743.94"), true);
  check("net", csv.includes("Income less costs,1906.06"), true);
}

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll year-end checks passed.\n");
