import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK helper is built against Zod 4, which ships alongside 3 on the
// "zod/v4" subpath. The rest of the app validates forms with the classic
// import; only the schemas handed to the API need the newer one.
import * as z from "zod/v4";
import { fingerprint } from "@/lib/opportunities";
import { site } from "@/lib/site";
import type { OpportunityKind, ResearchSettings } from "@/lib/data/types";

/**
 * The weekly hunt for grants and conferences.
 *
 * Claude reads the open web and reports what it finds. Two things about that
 * shape everything below.
 *
 * First, a model reading a funder's page can get a closing date or an
 * eligibility rule subtly wrong, and a wrong deadline costs a real
 * application. So every result must carry the page it came from, results
 * without a working link are thrown away, and each one is stored unverified —
 * the interface says so plainly until Tausha has checked the page herself.
 *
 * Second, this costs money each time it runs. It is weekly, capped, and it
 * fails closed: with no API key nothing runs and nothing is invented.
 */

export const DEFAULT_RESEARCH_SETTINGS: ResearchSettings = {
  enabled: true,
  profile: "",
  grant_notes: "",
  conference_notes: "",
  max_results: 12,
};

/* --------------------------- What we ask back for -------------------------- */

const money = z
  .number()
  .nullable()
  .describe("Whole Canadian dollars, not cents. Null if the page doesn't say.");

const date = z
  .string()
  .nullable()
  .describe("YYYY-MM-DD. Null if the page doesn't give a firm date.");

const GrantSchema = z.object({
  title: z.string().describe("The name of the grant or program."),
  organisation: z.string().nullable().describe("Who gives the money."),
  url: z.string().describe("The official page for this grant. Required."),
  summary: z.string().describe("Two or three plain sentences: what it funds."),
  why_relevant: z
    .string()
    .describe(
      "One or two sentences on why this suits this particular building and its work.",
    ),
  eligibility: z
    .string()
    .nullable()
    .describe("Who may apply, in plain words. Note if sole proprietors cannot."),
  amount_min: money,
  amount_max: money,
  deadline: date,
  covers_travel: z
    .boolean()
    .describe("True if it can pay for travel, conferences or training."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "How sure you are that the details above are right and the program is currently open. Low if the page was vague or looked out of date.",
    ),
});

const ConferenceSchema = z.object({
  title: z.string(),
  organisation: z.string().nullable().describe("Who runs it."),
  url: z.string().describe("The official page. Required."),
  summary: z.string().describe("Two or three plain sentences: what it is."),
  why_relevant: z.string(),
  starts_on: date,
  ends_on: date,
  location: z.string().nullable().describe("City and province, or 'Online'."),
  is_online: z.boolean(),
  cost: money.describe("Registration, in whole dollars. Null if not published."),
  cost_note: z
    .string()
    .nullable()
    .describe("Anything about pricing, e.g. 'early bird until 1 March'."),
  confidence: z.enum(["high", "medium", "low"]),
});

const GrantResults = z.object({ results: z.array(GrantSchema) });
const ConferenceResults = z.object({ results: z.array(ConferenceSchema) });

export type FoundOpportunity = {
  kind: OpportunityKind;
  title: string;
  organisation: string | null;
  url: string;
  summary: string;
  why_relevant: string;
  eligibility?: string | null;
  amount_min_cents?: number | null;
  amount_max_cents?: number | null;
  deadline?: string | null;
  covers_travel?: boolean;
  starts_on?: string | null;
  ends_on?: string | null;
  location?: string | null;
  is_online?: boolean;
  cost_cents?: number | null;
  cost_note?: string | null;
  confidence: "high" | "medium" | "low";
  fingerprint: string;
};

/* ------------------------------- The prompt -------------------------------- */

function systemPrompt(kind: OpportunityKind, settings: ResearchSettings): string {
  const today = new Date().toISOString().slice(0, 10);

  return [
    `Today is ${today}.`,
    "",
    `You are finding ${kind === "grant" ? "funding" : "conferences and trade shows"} for a small organisation in rural Alberta, Canada. Search the web, read the pages you find, and report what is actually there.`,
    "",
    "About the organisation:",
    settings.profile,
    `It is based at ${site.address.oneLine}.`,
    "",
    "What to look for:",
    kind === "grant" ? settings.grant_notes : settings.conference_notes,
    "",
    "Rules, and these matter more than finding a lot:",
    "",
    "1. Every result must have the official page it came from. If you cannot link to the real page, leave the result out.",
    "2. Report only what the page actually says. Do not infer a deadline, an amount, or an eligibility rule that isn't written there — leave the field null instead. A null is useful; a confident wrong date is not.",
    "3. Only include things that are currently open or upcoming. Leave out anything whose deadline or date has passed.",
    "4. Prefer a handful of genuinely good matches over a long list. An irrelevant result wastes an afternoon of somebody's time.",
    "5. Mark confidence honestly. Use low if the page was vague, undated, or looked like it hadn't been updated in a while.",
    kind === "grant"
      ? "6. This is a sole proprietorship, not a registered charity or nonprofit. Many funders require charitable status. You may still include such a grant if it is otherwise an excellent fit, but say so plainly in the eligibility field."
      : "6. Include online events — travel from southern Alberta is expensive and slow.",
    "",
    `Return at most ${settings.max_results} results.`,
  ].join("\n");
}

/* -------------------------------- The call --------------------------------- */

export type ResearchOutcome =
  | { ok: true; found: FoundOpportunity[] }
  | { ok: false; reason: string };

const toCents = (dollars: number | null | undefined) =>
  dollars == null ? null : Math.round(dollars * 100);

/** Keeps obviously-bad links out before they reach the database. */
function usableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function research(
  kind: OpportunityKind,
  settings: ResearchSettings,
): Promise<ResearchOutcome> {
  if (!settings.enabled) {
    return { ok: false, reason: "Weekly searching is switched off in settings." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fail closed. Inventing plausible grants would be worse than none.
    return {
      ok: false,
      reason:
        "No ANTHROPIC_API_KEY is set, so nothing was searched for. (Tyler: add it in Netlify.)",
    };
  }

  const client = new Anthropic({ apiKey });
  const schema = kind === "grant" ? GrantResults : ConferenceResults;

  try {
    // Streaming, because a research turn with web search runs for minutes and
    // a plain request would hit the HTTP timeout first.
    const stream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(schema),
      },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 20,
          user_location: {
            type: "approximate",
            country: "CA",
            region: "Alberta",
          },
        },
      ],
      system: systemPrompt(kind, settings),
      messages: [
        {
          role: "user",
          content:
            kind === "grant"
              ? "Find grants and funding programs this organisation could apply for."
              : "Find conferences, trade shows and training events worth attending.",
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { ok: false, reason: "The request was declined." };
    }

    // Pull the structured payload out of the response text.
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) return { ok: false, reason: "Nothing came back." };

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: "The results didn't come back as readable data." };
    }

    const checked = schema.safeParse(parsed);
    if (!checked.success) {
      return {
        ok: false,
        reason: `The results didn't match the expected shape: ${checked.error.issues[0]?.message ?? "unknown"}`,
      };
    }

    const found: FoundOpportunity[] = [];

    for (const r of checked.data.results) {
      if (!usableUrl(r.url)) continue;

      const base = {
        kind,
        title: r.title.trim(),
        organisation: r.organisation?.trim() || null,
        url: r.url,
        summary: r.summary.trim(),
        why_relevant: r.why_relevant.trim(),
        confidence: r.confidence,
        fingerprint: fingerprint(kind, r.title, r.url),
      };

      if (kind === "grant") {
        const g = r as z.infer<typeof GrantSchema>;
        found.push({
          ...base,
          eligibility: g.eligibility?.trim() || null,
          amount_min_cents: toCents(g.amount_min),
          amount_max_cents: toCents(g.amount_max),
          deadline: g.deadline,
          covers_travel: g.covers_travel,
        });
      } else {
        const c = r as z.infer<typeof ConferenceSchema>;
        found.push({
          ...base,
          starts_on: c.starts_on,
          ends_on: c.ends_on,
          location: c.location?.trim() || null,
          is_online: c.is_online,
          cost_cents: toCents(c.cost),
          cost_note: c.cost_note?.trim() || null,
        });
      }
    }

    return { ok: true, found };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: "The Anthropic API key was rejected." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, reason: "Rate limited — it will try again next week." };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, reason: `Search failed (${error.status}): ${error.message}` };
    }
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Search failed.",
    };
  }
}
