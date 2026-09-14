import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { amountRange, deadlineNote, stepsFor } from "@/lib/opportunities";
import { moneyExact } from "@/lib/format";
import { site } from "@/lib/site";
import type { OpportunityRow, OpportunityStepRow } from "@/lib/data/types";

/**
 * The briefing document.
 *
 * Tausha downloads this and hands it to whichever AI assistant she is using,
 * so it arrives knowing the building, the grant, and what still has to happen
 * — rather than her retyping all of it into a chat box.
 *
 * Two decisions shape it. It is written *to* the assistant, in the second
 * person, because that is who reads it. And it states plainly, near the top,
 * which figures were gathered automatically and have not been checked — an
 * assistant that treats an unverified deadline as settled will cheerfully help
 * her miss it.
 */

const PAGE = { width: 612, height: 792 }; // US Letter, in points
const MARGIN = 64;
const WIDTH = PAGE.width - MARGIN * 2;

type Style = "title" | "heading" | "body" | "small" | "label";

const SIZES: Record<Style, number> = {
  title: 20,
  heading: 13,
  body: 10.5,
  small: 9,
  label: 9,
};

const LEADING: Record<Style, number> = {
  title: 26,
  heading: 18,
  body: 15,
  small: 13,
  label: 13,
};

/** The poster's olive and ink, so the document looks like it belongs. */
const OLIVE = rgb(0.369, 0.431, 0.271);
const INK = rgb(0.227, 0.216, 0.184);
const SOFT = rgb(0.42, 0.4, 0.35);

export async function buildHandoffPdf(
  opportunity: OpportunityRow,
  steps: OpportunityStepRow[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  /** Wraps to the page width and starts a new page when it runs out. */
  const write = (
    text: string,
    style: Style = "body",
    opts: { color?: ReturnType<typeof rgb>; strong?: boolean; indent?: number } = {},
  ) => {
    const size = SIZES[style];
    const font = opts.strong || style === "title" || style === "heading" ? bold : regular;
    const indent = opts.indent ?? 0;
    const maxWidth = WIDTH - indent;

    for (const paragraph of text.split("\n")) {
      if (paragraph.trim() === "") {
        y -= LEADING[style] * 0.5;
        continue;
      }

      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          if (y < MARGIN + LEADING[style]) newPage();
          page.drawText(line, {
            x: MARGIN + indent,
            y,
            size,
            font,
            color: opts.color ?? INK,
          });
          y -= LEADING[style];
          line = word;
        } else {
          line = candidate;
        }
      }

      if (line) {
        if (y < MARGIN + LEADING[style]) newPage();
        page.drawText(line, {
          x: MARGIN + indent,
          y,
          size,
          font,
          color: opts.color ?? INK,
        });
        y -= LEADING[style];
      }
    }
  };

  const gap = (n = 1) => {
    y -= 8 * n;
  };

  const rule = () => {
    if (y < MARGIN + 20) newPage();
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.75,
      color: rgb(0.78, 0.74, 0.66),
    });
    y -= 14;
  };

  const isGrant = opportunity.kind === "grant";

  /* ------------------------------- Header -------------------------------- */

  write(site.name, "label", { color: OLIVE, strong: true });
  gap();
  write(
    isGrant ? "Grant application briefing" : "Conference briefing",
    "title",
    { color: OLIVE },
  );
  gap();
  write(opportunity.title, "heading");
  if (opportunity.organisation) {
    write(opportunity.organisation, "small", { color: SOFT });
  }
  gap(2);
  rule();

  /* ---------------------------- How to use this --------------------------- */

  write("How to use this document", "heading", { color: OLIVE });
  gap();
  write(
    "You are being asked to help Tausha Wiebe apply for the opportunity described below. She runs Room Within Community, a historic building in a town of roughly 650 people in southern Alberta. She is not a grant writer and is doing this alongside running the building. Write plainly, ask one question at a time, and do not assume she has documents an established organisation would have.",
  );
  gap();

  const unverified = !opportunity.verified_at;
  if (unverified) {
    write("Before you rely on any figure here", "body", { strong: true });
    write(
      "The details below were gathered automatically by reading the funder's website, and have not yet been checked by a person. Treat the deadline, the amounts and the eligibility rules as unconfirmed. Your first job is to have her open the official link and confirm them. Do not build a plan or a timeline on these numbers until she has.",
    );
  } else {
    write(
      `These details were checked against the official page on ${new Date(opportunity.verified_at!).toLocaleDateString("en-CA")}. It is still worth a look before submitting.`,
      "small",
      { color: SOFT },
    );
  }
  gap(2);
  rule();

  /* ------------------------------ The place ------------------------------- */

  write("About Room Within Community", "heading", { color: OLIVE });
  gap();
  write(
    [
      `Room Within Community is at ${site.address.oneLine}. It is a 1905 building being restored into a community hub for Grassy Lake and the surrounding area.`,
      "",
      "It runs as a sole proprietorship. It is NOT a registered charity and NOT an incorporated non-profit. This matters for eligibility on most funding programs, and it is the first thing to check on any grant. It also means donations to it are not tax-deductible.",
      "",
      "What happens in the building: rooms let by the hour or the day for meetings, classes and gatherings; offices and suites let monthly; community classes taught by local people on a sliding scale so cost is not a barrier; a maker space; and a private counselling practice.",
      "",
      "What the money is needed for: buying the building, and repairing it — roof, windows, masonry, accessibility and safety work — then fitting out the rooms so more of them can be used.",
    ].join("\n"),
  );
  gap(2);
  rule();

  /* --------------------------- The opportunity ---------------------------- */

  write(isGrant ? "The grant" : "The event", "heading", { color: OLIVE });
  gap();

  const fact = (label: string, value: string | null | undefined) => {
    if (!value) return;
    write(`${label}: ${value}`, "body");
  };

  fact("Name", opportunity.title);
  fact(isGrant ? "Funder" : "Run by", opportunity.organisation);
  fact("Official page", opportunity.url);

  if (isGrant) {
    fact("Amount", amountRange(opportunity, moneyExact) ?? "Not stated on the page");
    fact(
      "Deadline",
      opportunity.deadline
        ? `${opportunity.deadline} — ${deadlineNote(opportunity.deadline)}`
        : "None given",
    );
    fact("Who may apply", opportunity.eligibility);
  } else {
    fact(
      "Dates",
      opportunity.starts_on
        ? opportunity.ends_on && opportunity.ends_on !== opportunity.starts_on
          ? `${opportunity.starts_on} to ${opportunity.ends_on}`
          : opportunity.starts_on
        : "Not stated",
    );
    fact("Where", opportunity.location ?? (opportunity.is_online ? "Online" : null));
    fact(
      "Registration",
      opportunity.cost_cents != null ? moneyExact(opportunity.cost_cents) : "Not published",
    );
    fact("On pricing", opportunity.cost_note);
  }

  if (opportunity.summary) {
    gap();
    write("What it is", "body", { strong: true });
    write(opportunity.summary);
  }

  if (opportunity.why_relevant) {
    gap();
    write("Why it was flagged for this building", "body", { strong: true });
    write(opportunity.why_relevant);
  }

  if (opportunity.notes) {
    gap();
    write("Tausha's own notes", "body", { strong: true });
    write(opportunity.notes);
  }

  gap(2);
  rule();

  /* ------------------------------ The steps ------------------------------- */

  write("Where she has got to", "heading", { color: OLIVE });
  gap();

  const ordered = steps.length
    ? [...steps].sort((a, b) => a.position - b.position)
    : stepsFor(opportunity.kind).map((s, i) => ({
        id: `t${i}`,
        opportunity_id: opportunity.id,
        position: i + 1,
        title: s.title,
        detail: s.detail,
        done_at: null,
        created_at: "",
      }));

  const done = ordered.filter((s) => s.done_at).length;
  write(
    `${done} of ${ordered.length} steps finished. Pick up at the first unfinished one.`,
    "small",
    { color: SOFT },
  );
  gap();

  for (const step of ordered) {
    if (y < MARGIN + 60) newPage();
    const mark = step.done_at ? "[done]" : "[  ]";
    write(`${mark}  ${step.position}. ${step.title}`, "body", {
      strong: !step.done_at,
      color: step.done_at ? SOFT : INK,
    });
    if (step.detail) {
      write(step.detail, "small", { color: SOFT, indent: 22 });
    }
    gap();
  }

  rule();

  /* ------------------------------ The ask --------------------------------- */

  write("What to do first", "heading", { color: OLIVE });
  gap();
  write(
    [
      unverified
        ? "1. Ask her to open the official page and confirm the deadline, the amount, and whether a sole proprietorship may apply. Wait for her answer before going further."
        : "1. Confirm the deadline is still what this document says.",
      "2. Ask what specifically she wants this money to pay for, and roughly what that costs. One thing, not a list.",
      "3. Work out what the funder needs from her, and which of it she does not yet have. Letters of support take the longest — start those first.",
      "4. Draft in her voice, not a grant-writing voice. Short sentences. Real numbers. No jargon she would not use out loud.",
      "",
      "Do not invent figures, dates, or details about the building. If you need a number she has not given you, ask for it.",
    ].join("\n"),
  );

  gap(2);
  write(
    `Prepared by the Room Within app on ${new Date().toLocaleDateString("en-CA")}. ${site.email}`,
    "small",
    { color: SOFT },
  );

  return pdf.save();
}

/** A filename that sorts sensibly in a downloads folder. */
export function handoffFilename(opportunity: OpportunityRow): string {
  const slug = opportunity.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${opportunity.kind}-briefing-${slug}.pdf`;
}
