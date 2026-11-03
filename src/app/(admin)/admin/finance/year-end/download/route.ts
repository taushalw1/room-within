import { requireBooks } from "@/lib/auth";
import { getYearEndInput } from "@/lib/data/year-end";
import { buildYearEnd, summaryCsv, transactionsCsv } from "@/lib/year-end";

/**
 * The two files for the accountant.
 *
 * A route handler rather than a server action, because the thing being
 * produced is a download: the browser needs a real response with a filename
 * on it, not a value returned into a React state.
 *
 * `requireAdmin` runs first and redirects rather than returning a file. These
 * are every payment and every cost of a whole year, which is the most
 * sensitive thing the app can hand out in one go.
 */
export async function GET(request: Request) {
  // The accountant downloads these too, so the gate is the books gate
  // rather than the admin one. It still refuses everybody else.
  await requireBooks();

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const what = url.searchParams.get("what") === "summary" ? "summary" : "transactions";

  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    return new Response("Which year?", { status: 400 });
  }

  const input = await getYearEndInput(year);

  const body =
    what === "summary"
      ? summaryCsv(buildYearEnd(input))
      : transactionsCsv(input);

  const name =
    what === "summary"
      ? `room-within-${year}-summary.csv`
      : `room-within-${year}-transactions.csv`;

  // The byte-order mark is what makes Excel open a UTF-8 CSV without
  // mangling anything accented — a name like Oyelaran comes out as mojibake
  // otherwise, and the first thing anybody does with this file is open it in
  // Excel.
  return new Response(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
