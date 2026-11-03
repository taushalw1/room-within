/**
 * Known-answer checks for the move-in progress.
 *
 * The rule worth protecting is that a step the law cares about outranks a
 * nice-to-have. If that inverts, the page cheerfully suggests sending a
 * welcome email to somebody whose inspection was never done — which is the
 * exact failure the card exists to prevent, delivered confidently.
 */
import { moveInProgress, type MoveInFacts } from "../src/lib/onboarding";

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
  check("nine steps", p.total, 9);
  check("not complete", p.complete, false);
  // The first two steps in the list are optional, so neither may be "next".
  check("next is a needed one", p.next?.key, "emergency");
  check("six needed outstanding", p.outstanding.length, 6);
}

console.log("\nEverything done");
{
  const p = moveInProgress(everything, LEASE);
  check("complete", p.complete, true);
  check("nothing next", p.next, null);
  check("nothing outstanding", p.outstanding.length, 0);
  check("all counted", p.done, 9);
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

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll move-in checks passed.\n");
