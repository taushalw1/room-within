/**
 * Known-answer checks for the move-in progress.
 *
 * The rule worth protecting is that a step the law cares about outranks a
 * nice-to-have. If that inverts, the page cheerfully suggests sending a
 * welcome email to somebody whose inspection was never done — which is the
 * exact failure the card exists to prevent, delivered confidently.
 */
import { moveInProgress, type MoveInFacts } from "../src/lib/onboarding";
import { lengthOfStay } from "../src/lib/format";

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

const nothing: MoveInFacts = {
  hasEmail: false,
  hasEmergencyContact: false,
  keysIssued: null,
  depositHeldCents: 0,
  invoiceRaised: false,
  inspectionStarted: false,
  inspectionSigned: false,
  hasAccount: false,
  hasSignature: false,
  welcomed: false,
};

const everything: MoveInFacts = {
  hasEmail: true,
  hasEmergencyContact: true,
  keysIssued: 2,
  depositHeldCents: 120_000,
  invoiceRaised: true,
  inspectionStarted: true,
  inspectionSigned: true,
  hasAccount: true,
  hasSignature: true,
  welcomed: true,
};

const LEASE = "lease-1";

console.log("\nNothing done");
{
  const p = moveInProgress(nothing, LEASE);
  check("none done", p.done, 0);
  check("ten steps", p.total, 10);
  check("not complete", p.complete, false);
  // The first two steps in the list are optional, so neither may be "next".
  check("next is a needed one", p.next?.key, "email");
  check("seven needed outstanding", p.outstanding.length, 7);
}

console.log("\nEverything done");
{
  const p = moveInProgress(everything, LEASE);
  check("complete", p.complete, true);
  check("nothing next", p.next, null);
  check("nothing outstanding", p.outstanding.length, 0);
  check("all counted", p.done, 10);
}

console.log("\nOnly the optional ones left");
{
  const p = moveInProgress(
    { ...everything, hasAccount: false, welcomed: false, hasSignature: false },
    LEASE,
  );
  check("not complete", p.complete, false);
  // Nothing needed is outstanding, so the card must not nag — but there is
  // still a sensible next thing to offer.
  check("nothing needed outstanding", p.outstanding.length, 0);
  check("falls back to an optional one", p.next?.key, "account");
  check("marked as optional", p.next?.weight, "worth doing");
}

console.log("\nA needed step always outranks an optional one");
{
  // Everything done except one optional step early in the list and one
  // needed step late in it. The needed one must win despite coming later.
  const p = moveInProgress(
    { ...everything, hasAccount: false, invoiceRaised: false },
    LEASE,
  );
  check("next is the needed one", p.next?.key, "invoice");
}

console.log("\nZero is not the same as nothing");
{
  // Keys genuinely counted as zero — a tenancy with no keys issued at all —
  // is recorded, not missing. `keysIssued: 0` must count as done.
  const p = moveInProgress({ ...everything, keysIssued: 0 }, LEASE);
  check("no keys issued still counts", p.complete, true);
}
{
  const p = moveInProgress({ ...everything, depositHeldCents: 0 }, LEASE);
  check("no deposit is not done", p.next?.key, "deposit");
}

console.log("\nHow long somebody has been here");
{
  // The tenancies inherited with the building are the reason this exists:
  // "since 14 Mar 2019" is arithmetic, "7 years" is the fact.
  check("same day", lengthOfStay("2026-11-03", "2026-11-03"), "under a month");
  check("part of a month", lengthOfStay("2026-10-20", "2026-11-03"), "under a month");
  check("one month exactly", lengthOfStay("2026-10-03", "2026-11-03"), "1 month");
  check("a day short of a month", lengthOfStay("2026-10-04", "2026-11-03"), "under a month");
  check("several months", lengthOfStay("2026-05-03", "2026-11-03"), "6 months");
  check("a year", lengthOfStay("2025-11-03", "2026-11-03"), "1 year");
  check("years and months", lengthOfStay("2019-03-14", "2026-11-03"), "7 years, 7 months");
  check("exact years", lengthOfStay("2019-11-03", "2026-11-03"), "7 years");
  check("a future start", lengthOfStay("2027-01-01", "2026-11-03"), "not yet started");
}

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll move-in checks passed.\n");
