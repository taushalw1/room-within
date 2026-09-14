import type {
  OpportunityRow,
  OpportunityStatus,
  OpportunityStepRow,
} from "@/lib/data/types";

/**
 * The rules around grants and conferences.
 *
 * Plain arithmetic and plain text — no database, no network — so the same
 * logic drives the pages, the checklist, and the handoff document.
 */

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  new: "New",
  interested: "Interested",
  not_interested: "Not for us",
  applied: "Applied",
  awarded: "We got it",
  rejected: "Turned down",
};

export const STATUS_TONES: Record<
  OpportunityStatus,
  "neutral" | "good" | "warn" | "bad" | "info"
> = {
  new: "warn",
  interested: "info",
  not_interested: "neutral",
  applied: "info",
  awarded: "good",
  rejected: "bad",
};

/** The order the lists are shown in. */
export const STATUS_ORDER: OpportunityStatus[] = [
  "new",
  "interested",
  "applied",
  "awarded",
  "rejected",
  "not_interested",
];

/* ------------------------------- Deadlines -------------------------------- */

/** Whole days from today until a date. Negative once it has gone. */
export function daysUntil(date: string | null, today = new Date()): number | null {
  if (!date) return null;
  const then = new Date(`${date}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((then.getTime() - start.getTime()) / 86_400_000);
}

export type Urgency = "passed" | "urgent" | "soon" | "later" | "none";

/**
 * How pressing a deadline is.
 *
 * A grant application is weeks of work, so "soon" starts at six weeks rather
 * than the few days that would be sensible for an invoice.
 */
export function urgencyOf(date: string | null, today = new Date()): Urgency {
  const days = daysUntil(date, today);
  if (days === null) return "none";
  if (days < 0) return "passed";
  if (days <= 14) return "urgent";
  if (days <= 42) return "soon";
  return "later";
}

export function deadlineNote(date: string | null, today = new Date()): string {
  const days = daysUntil(date, today);
  if (days === null) return "No deadline given";
  if (days < 0) return `Closed ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 60) return `${days} days left`;
  const weeks = Math.round(days / 7);
  return `About ${weeks} weeks away`;
}

/* ------------------------------- Money ------------------------------------ */

/** "$5,000 – $25,000", or one figure, or nothing. */
export function amountRange(
  o: Pick<OpportunityRow, "amount_min_cents" | "amount_max_cents">,
  format: (cents: number) => string,
): string | null {
  const { amount_min_cents: min, amount_max_cents: max } = o;
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? format(min) : `${format(min)} – ${format(max)}`;
  }
  return max != null ? `Up to ${format(max)}` : `From ${format(min!)}`;
}

/* ------------------------------ The checklist ------------------------------ */

type StepTemplate = { title: string; detail: string };

/**
 * The steps for applying to a grant.
 *
 * Deliberately written as things to *do* in an afternoon, not as headings. The
 * first step is always to read the real page, because everything below it was
 * assembled by a machine reading the web and could be wrong.
 */
export const GRANT_STEPS: StepTemplate[] = [
  {
    title: "Read the funder's own page and check the basics",
    detail:
      "Open the link and confirm three things for yourself: the closing date, that a sole proprietorship can apply, and roughly how much they give. If any of those don't match what's written here, correct it before going further — everything on this page was gathered automatically and can be out of date.",
  },
  {
    title: "Decide whether it's worth the hours",
    detail:
      "Some applications take a weekend. Compare what they give against what it will cost you in time, and against how well the building actually fits what they fund. It is entirely fine to mark this Not for us.",
  },
  {
    title: "Write down what you're asking money for",
    detail:
      "One paragraph, in your own words: the specific thing this money would pay for, what it costs, and what changes once it's done. Funders reject vague asks more often than small ones.",
  },
  {
    title: "Gather the paperwork they ask for",
    detail:
      "Usually some of: business registration, last year's figures, a budget for the project, proof of address or ownership, insurance, and two or three letters of support. Start the letters first — they depend on other people.",
  },
  {
    title: "Build the budget",
    detail:
      "A simple table: each cost, what it is, and where the rest of the money is coming from. Most funders want to see that you are putting something in yourself, whether that is cash, donated labour, or materials.",
  },
  {
    title: "Draft the application",
    detail:
      "Answer their questions in their order, using their words. Don't reuse another application wholesale — the mismatch shows. Keep it plain; nobody has ever been turned down for being too easy to read.",
  },
  {
    title: "Have somebody else read it",
    detail:
      "Someone who doesn't know the project. If they can't say back to you what you're asking for and why, it isn't clear enough yet.",
  },
  {
    title: "Submit it, and save a copy",
    detail:
      "Keep the submitted version and any reference number. Note the date here. If they say when decisions are made, put that in your calendar.",
  },
  {
    title: "Follow up",
    detail:
      "If the decision date passes with no word, a short polite email is entirely normal. If you are turned down, ask what would make a future application stronger — most funders will tell you, and it is the most useful half hour you'll spend.",
  },
];

/** The steps for going to a conference. Shorter, because it usually is. */
export const CONFERENCE_STEPS: StepTemplate[] = [
  {
    title: "Check the dates and the real cost on their page",
    detail:
      "Confirm the dates, the registration fee, and whether early-bird pricing is still open. Details here were gathered automatically and may have moved.",
  },
  {
    title: "Work out the whole cost",
    detail:
      "Registration, travel, somewhere to stay, meals, and the days you are not at the building. That total is the number to decide on, not the ticket price.",
  },
  {
    title: "Look for funding",
    detail:
      "Some grants pay for professional development or travel. Any that do are listed on this page. Apply before you book if you can.",
  },
  {
    title: "Decide and book",
    detail:
      "If you are going, book while early pricing lasts, and put it in the calendar so nothing else gets scheduled over it.",
  },
  {
    title: "Plan who you want to meet",
    detail:
      "The sessions are rarely the valuable part. Look at who else is going and write down three or four people or organisations worth finding while you're there.",
  },
  {
    title: "Write up what came of it",
    detail:
      "A few notes afterwards, while it's fresh: who you met, what you'd do differently, and whether it was worth the money. That is what tells you whether to go again next year.",
  },
];

export function stepsFor(kind: OpportunityRow["kind"]): StepTemplate[] {
  return kind === "grant" ? GRANT_STEPS : CONFERENCE_STEPS;
}

export function stepProgress(steps: OpportunityStepRow[]): {
  done: number;
  total: number;
  next: OpportunityStepRow | null;
} {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const done = ordered.filter((s) => s.done_at).length;
  return {
    done,
    total: ordered.length,
    next: ordered.find((s) => !s.done_at) ?? null,
  };
}

/* ----------------------------- Deduplication ------------------------------ */

/**
 * A stable key for "the same opportunity".
 *
 * Built from the host and the title rather than the full URL, because funders
 * move pages around and reword tracking parameters onto links, and the same
 * grant reappearing every Monday as a new row would make the list useless.
 */
export function fingerprint(kind: string, title: string, url?: string | null): string {
  const host = (() => {
    if (!url) return "";
    try {
      return new URL(url).hostname.replace(/^www[.]/, "");
    } catch {
      return "";
    }
  })();

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${kind}:${host}:${slug}`;
}
