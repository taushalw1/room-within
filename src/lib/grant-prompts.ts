import { amountRange, deadlineNote } from "@/lib/opportunities";
import { moneyExact } from "@/lib/format";
import { site } from "@/lib/site";
import type { OpportunityRow } from "@/lib/data/types";

/**
 * The two pieces of writing that turn a row in a list into something she can
 * act on: an email to the funder, and a briefing for her own AI assistant.
 *
 * Both are generated rather than stored, so they always reflect the current
 * state of the grant. Both are drafts — nothing sends or runs on its own.
 */

/* ------------------------------ The outreach ------------------------------ */

/**
 * A first email to a funder.
 *
 * Deliberately short. It asks one question — can we talk — rather than trying
 * to make the whole case in a cold email, because the aim is twenty minutes on
 * the phone with somebody who can say "you're not eligible" before she spends
 * a weekend writing an application. It also says plainly that Room Within is a
 * sole proprietorship, since that is the first thing most funders will check
 * and burying it wastes everyone's time.
 */
export function outreachDraft(grant: OpportunityRow): {
  to: string;
  subject: string;
  body: string;
} {
  const greeting = grant.contact_name
    ? `Dear ${grant.contact_name},`
    : "Hello,";

  const closing = grant.deadline
    ? `I can see the current deadline is ${deadlineNote(grant.deadline).toLowerCase()}, so I would rather find out early whether this is a fit than submit something that was never eligible.`
    : "I would rather find out early whether this is a fit than submit something that was never eligible.";

  const body = [
    greeting,
    "",
    `My name is Tausha Torrie. I am restoring a 1905 building at ${site.address.oneLine} into a community hub — rooms and offices to let, classes taught by people who live here, a maker space, and counselling. It is called Room Within Community.`,
    "",
    `I am looking at ${grant.title} and would like to ask a few questions before applying.`,
    "",
    "The main one is eligibility. Room Within currently operates as a sole proprietorship rather than an incorporated non-profit, and I know that matters for many programs. If that rules us out, I would be glad to know now. If there is a route — partnering with a community group, or a different stream — I would like to understand it.",
    "",
    "Could we arrange a short call? Twenty minutes would be plenty. I am flexible on timing and happy to work around you.",
    "",
    closing,
    "",
    "Thank you for your time.",
    "",
    "Tausha Torrie",
    "Owner, Room Within",
    "403-849-8227",
    "www.roomwithin.ca",
  ].join("\n");

  return {
    to: grant.contact_email ?? "",
    subject: `Question about ${grant.title} — Room Within Community, Grassy Lake`,
    body,
  };
}

/* ------------------------------ The AI briefing --------------------------- */

const UNKNOWN = "not stated on the funder's page";

/**
 * The prompt she pastes into Claude.
 *
 * Three things make it work rather than just being a wall of context.
 *
 * It tells the assistant to ask one question at a time, with options, because
 * an open "tell me about your project" invites a paragraph she doesn't have
 * the energy to write at ten at night.
 *
 * It says what to do when she answers "I don't know" — which is the honest
 * answer to half of what a grant application asks, and the point at which
 * most people abandon the form. Rather than guessing, the assistant explains
 * where that information lives and offers to draft the email that gets it.
 *
 * And it states which figures are unverified, so the assistant does not build
 * a plan on a deadline nobody has checked.
 */
export function assistantPrompt(grant: OpportunityRow): string {
  const unverified = !grant.verified_at;

  const facts = [
    `- Name: ${grant.title}`,
    `- Funder: ${grant.organisation ?? UNKNOWN}`,
    `- Their page: ${grant.url ?? UNKNOWN}`,
    grant.application_url ? `- Application form: ${grant.application_url}` : null,
    `- Amount: ${amountRange(grant, moneyExact) ?? UNKNOWN}`,
    grant.match_percent != null
      ? `- They pay ${grant.match_percent}% of the project; we have to find the other ${100 - grant.match_percent}%.${grant.match_note ? ` ${grant.match_note}` : ""}`
      : "- Matching requirement: not stated. Worth checking — most capital grants only pay a share.",
    `- Deadline: ${grant.deadline ?? grant.deadline_note ?? UNKNOWN}`,
    `- Who may apply: ${grant.eligibility ?? UNKNOWN}`,
    grant.contact_email || grant.contact_phone
      ? `- Contact: ${[grant.contact_name, grant.contact_email, grant.contact_phone].filter(Boolean).join(" · ")}`
      : null,
    grant.notes ? `- Tausha's own notes: ${grant.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `I am applying for a grant and I would like your help. Please read all of this before replying.

## Who I am

I am Tausha Torrie. I own Room Within Community — a 1905 building at ${site.address.oneLine}, in a town of roughly 650 people in southern Alberta, which I am restoring into a community hub.

What happens in the building: rooms let by the hour or the day for meetings and gatherings; offices and suites let monthly; community classes taught by local people on a sliding scale so cost is never the reason somebody stays home; a maker space; and a counselling practice.

What the money is for: buying the building, and repairing it — roof, windows, masonry, accessibility and safety — then fitting out rooms so more of them can be used.

**Important:** Room Within runs as a **sole proprietorship**. It is NOT a registered charity and NOT an incorporated non-profit. Many funders require charitable status, so this is the first thing to check on any grant, and it should shape how we answer every eligibility question. Do not assume otherwise.

I am not a grant writer. I am doing this alongside actually running the building. Please write plainly and keep it short.

## The grant

${facts}

${
  unverified
    ? `**These details have not been checked by a person.** They were gathered automatically by reading the funder's website. Treat the deadline, the amounts and the eligibility rules as unconfirmed. Before we build any plan or timeline on them, ask me to open the link and confirm.`
    : `I have checked these details against the funder's own page myself.`
}

## How I would like you to work with me

**Ask me one question at a time.** Wait for my answer before the next one. Do not send me a list of ten questions — I will not answer them.

**Give me options wherever you can.** Instead of "what is your project budget?", ask something like:

> Roughly what is this project likely to cost?
> A) Under $25,000
> B) $25,000 – $100,000
> C) $100,000 – $500,000
> D) More than that
> E) I don't know yet

Multiple choice, or a single short thing to fill in. Never a paragraph.

**When I say "I don't know" — and I will, often — do not guess, and do not move on.** Instead:
1. Tell me plainly where that information normally lives (a document, a person, an office, a website).
2. Give me the simplest way to get it — who to phone, what to search for, which drawer to look in.
3. Offer to write the email or the list of questions that gets it. If I say yes, write it in my voice: short, plain, no jargon.
4. Then park that question and carry on with the rest. We can come back to it.

**Never invent a number, a date, or a fact about my building.** If you need something I have not given you, ask me for it. A blank we both know about is fine; a confident wrong figure in a grant application is not.

## What to do first

1. ${unverified ? "Ask me to open the funder's link and confirm the deadline, the amount, and whether a sole proprietorship can apply. Wait for my answer before going further." : "Confirm the deadline is still what I have written above."}
2. If there is an application form linked above, ask me to download it and paste or attach it here so you can see the actual questions.
3. Then work through what the funder needs, one question at a time, using the rules above.
4. When we have enough, help me draft the answers in my own voice — short sentences, real numbers, nothing I would not say out loud.

Start with step one.`;
}
