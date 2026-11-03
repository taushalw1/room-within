/**
 * Getting somebody properly moved in.
 *
 * Deliberately **not** another checklist table. Every step below is worked
 * out from records that already exist — the lease, the deposit ledger, the
 * inspection, the invoices — so it cannot drift out of step with reality the
 * way a list of boxes does. A box ticked by hand records that somebody
 * remembered to tick a box; this records whether the thing was actually done.
 *
 * The order is the order they happen in, and the first unfinished one is the
 * one to show. A list of seven things is paralysing; "next: record the
 * deposit" is a task.
 */

export type MoveInFacts = {
  /** From the lease. */
  hasEmergencyContact: boolean;
  keysIssued: number | null;
  /** A 'held' row in the deposit ledger. */
  depositHeldCents: number;
  /** Any invoice raised against this tenancy. */
  invoiceRaised: boolean;
  /** A move-in inspection exists. */
  inspectionStarted: boolean;
  /** …and the tenant has signed it, either way. */
  inspectionSigned: boolean;
  /**
   * There is an email address on their contact record.
   *
   * Signing in is passwordless and the account is matched to the tenancy by
   * email, so a tenant with no address on file can never reach their own
   * portal however many times they try.
   */
  hasEmail: boolean;
  /** They have an account, and a signature stored on it. */
  hasAccount: boolean;
  hasSignature: boolean;
  /** Something has been emailed to them from the app. */
  welcomed: boolean;
};

export type Step = {
  key: string;
  label: string;
  /** What to do, in plain words, when it isn't done. */
  todo: string;
  done: boolean;
  /** Where to go and do it. */
  href: string;
  /**
   * Whether skipping it is a real problem. The law cares about some of these
   * and not others, and a page that treats "no vehicle recorded" the same as
   * "no inspection" has taught her to ignore all of it.
   */
  weight: "needed" | "worth doing";
};

export function moveInSteps(facts: MoveInFacts, leaseId: string): Step[] {
  const steps: Step[] = [
    {
      key: "email",
      label: "Email address on file",
      todo:
        "Without one they can never sign in — the account is matched to the " +
        "tenancy by email address, so there is nothing to match.",
      done: facts.hasEmail,
      href: "/admin/contacts",
      weight: "needed",
    },
    {
      key: "account",
      label: "They can sign in",
      todo:
        "They sign in themselves at the website with the same address you " +
        "have on file — there's no invite to send. If it isn't working, check " +
        "the address matches the one they're typing.",
      done: facts.hasAccount,
      href: "/admin/contacts",
      weight: "worth doing",
    },
    {
      key: "welcome",
      label: "Welcomed",
      todo: "Send them the welcome message — what the rent is, and how to report something broken.",
      done: facts.welcomed,
      href: "/admin/messages",
      weight: "worth doing",
    },
    {
      key: "emergency",
      label: "Emergency contact taken",
      todo: "Who to ring at eleven at night when there's water coming through a ceiling.",
      done: facts.hasEmergencyContact,
      href: `/admin/rentals`,
      weight: "needed",
    },
    {
      key: "keys",
      label: "Keys counted",
      todo: "How many keys, fobs and remotes went out — checked back against this when they leave.",
      done: facts.keysIssued !== null,
      href: `/admin/rentals`,
      weight: "needed",
    },
    {
      key: "deposit",
      label: "Deposit recorded",
      todo: "Put the deposit on the ledger, so what's held is a record rather than a memory.",
      done: facts.depositHeldCents > 0,
      href: `/admin/rentals`,
      weight: "needed",
    },
    {
      key: "inspection",
      label: "Move-in inspection done",
      todo: "Alberta asks for one. Without it you can't show later that damage wasn't already there.",
      done: facts.inspectionStarted,
      href: `/admin/rentals`,
      weight: "needed",
    },
    {
      key: "signed",
      label: "Inspection signed by them",
      todo: "Send them the inspection so they can agree it — or say where they don't.",
      done: facts.inspectionSigned,
      href: `/admin/rentals`,
      weight: "needed",
    },
    {
      key: "signature",
      label: "Their signature on file",
      todo: "They add it themselves, once, from their own account — then anything they sign is provably theirs.",
      done: facts.hasSignature,
      href: "/admin/rentals",
      weight: "worth doing",
    },
    {
      key: "invoice",
      label: "First rent invoice raised",
      todo: "Raise the first one, or generate the month's rent from the Rentals page.",
      done: facts.invoiceRaised,
      href: `/admin/rentals`,
      weight: "needed",
    },
  ];

  // Anything pointing at the Rentals page is aimed at this tenancy's own row,
  // so a link from here lands on the thing it is talking about rather than at
  // the top of a long page.
  return steps.map((s) => ({
    ...s,
    href: s.href === "/admin/rentals" ? `/admin/rentals#${leaseId}` : s.href,
  }));
}

export type MoveInProgress = {
  steps: Step[];
  done: number;
  total: number;
  /** The first unfinished step, strongest first. Null when finished. */
  next: Step | null;
  /** Unfinished steps that actually matter. */
  outstanding: Step[];
  complete: boolean;
};

export function moveInProgress(
  facts: MoveInFacts,
  leaseId: string,
): MoveInProgress {
  const steps = moveInSteps(facts, leaseId);
  const undone = steps.filter((s) => !s.done);

  // A needed step outranks a nice-to-have, whatever order they come in. The
  // point of showing one thing is that it is the right thing.
  const needed = undone.filter((s) => s.weight === "needed");

  return {
    steps,
    done: steps.length - undone.length,
    total: steps.length,
    next: needed[0] ?? undone[0] ?? null,
    outstanding: needed,
    complete: undone.length === 0,
  };
}
