import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// Zod 4, as the SDK helper expects. The rest of the app validates forms with
// the classic import.
import * as z from "zod/v4";

/**
 * Reading a receipt so it doesn't have to be typed.
 *
 * Entering costs by hand is the chore most likely to be skipped, and skipped
 * costs are what make a year-end reconstruction take a weekend. Photographing
 * a receipt and having the fields come back filled in removes most of that.
 *
 * Two rules, both about not quietly getting it wrong:
 *
 *   - Nothing is saved from this. It fills in a form, and Tausha presses the
 *     button. A misread total that saved itself would be worse than typing.
 *   - Every field may come back null, and null means "I couldn't read it",
 *     never zero and never a guess. A receipt photographed at an angle in bad
 *     light is normal, and half a receipt read correctly still saves most of
 *     the typing.
 */

const Receipt = z.object({
  vendor: z
    .string()
    .nullable()
    .describe("The shop or supplier name, as printed. Null if not legible."),
  incurred_on: z
    .string()
    .nullable()
    .describe(
      "The date on the receipt as YYYY-MM-DD. Null if there is no date or it cannot be read with confidence. Never today's date as a substitute.",
    ),
  total: z
    .number()
    .nullable()
    .describe(
      "The grand total actually paid, in dollars, including tax. Null if not legible.",
    ),
  tax: z
    .number()
    .nullable()
    .describe(
      "GST or total tax, in dollars, only if it is printed separately. Null otherwise — do not calculate it.",
    ),
  payment_method: z
    .string()
    .nullable()
    .describe(
      "How it was paid, if the receipt says: Debit, Credit card, Cash, Cheque. Null otherwise.",
    ),
  category: z
    .string()
    .nullable()
    .describe(
      "Which of the given categories fits best, copied exactly. Null if none clearly fits.",
    ),
  description: z
    .string()
    .nullable()
    .describe(
      "A short plain description of what was bought, from the line items. One line.",
    ),
  unreadable: z
    .array(z.string())
    .describe(
      "Field names you could not read with confidence. Empty if the receipt was clear.",
    ),
  note: z
    .string()
    .nullable()
    .describe(
      "Anything worth telling the person before they save it — a total that may be a subtotal, a date that could be read two ways, a receipt that is partly cut off.",
    ),
});

export type ReceiptReading = z.infer<typeof Receipt>;

export type ReadResult =
  | { ok: true; reading: ReceiptReading }
  | { ok: false; reason: string };

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function systemPrompt(categories: string[]): string {
  return [
    "You read photographs of receipts for a small building in Grassy Lake, Alberta, and report what is printed on them.",
    "",
    "The person reading your answer will check it before saving, so being honest about what you cannot read is far more useful than filling every field.",
    "",
    "Rules:",
    "- Report only what is actually printed. Never infer, estimate or calculate a figure that is not there.",
    "- The total is the grand total paid including tax, not a subtotal. If the image is cut off below the subtotal, say so in `note` and leave the total null.",
    "- Canadian receipts show GST separately. Report tax only if it is printed as its own line.",
    "- Dates are often ambiguous. Alberta receipts are usually YYYY-MM-DD or DD/MM/YYYY, but American tills print MM/DD/YYYY. If a date could be read two ways, leave it null and explain in `note`.",
    "- Amounts are dollars, not cents. 42.50 means forty-two dollars fifty.",
    "",
    `Categories to choose from, copied exactly: ${categories.join(", ")}.`,
    "",
    "If the image is not a receipt at all, set every field null and say so in `note`.",
  ].join("\n");
}

/**
 * Read one receipt.
 *
 * Fails closed and fails quietly: with no API key, or on any error, this
 * returns a reason and the form stays empty, which is exactly where it would
 * have been anyway. Nothing here is load-bearing.
 */
export async function readReceipt(
  file: File,
  categories: string[],
): Promise<ReadResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason:
        "Reading receipts needs an API key, which isn't set up yet. Tyler can add it.",
    };
  }

  if (!ALLOWED.has(file.type)) {
    return { ok: false, reason: "That needs to be a photo — JPEG, PNG or WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "That photo is too big. Under 5MB works." };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2000,
      output_config: { format: zodOutputFormat(Receipt) },
      system: systemPrompt(categories),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as
                  | "image/png"
                  | "image/jpeg"
                  | "image/webp"
                  | "image/gif",
                data: base64,
              },
            },
            { type: "text", text: "Read this receipt." },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return { ok: false, reason: "That image couldn't be read." };
    }

    const block = message.content.find((c) => c.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, reason: "Nothing came back. Try again, or type it in." };
    }

    const parsed = Receipt.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      return { ok: false, reason: "That came back in a shape we couldn't use." };
    }

    return { ok: true, reading: parsed.data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Something went wrong.";
    return { ok: false, reason: `Couldn't read it: ${reason}` };
  }
}
