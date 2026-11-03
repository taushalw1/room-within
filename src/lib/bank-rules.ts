/**
 * "Anything from FORTIS ALBERTA is Utilities."
 *
 * A rule saves her categorising the same direct debit twelve times a year.
 * The matching is deliberately dull — a case-insensitive substring of the
 * bank's description — because a rule she cannot predict the behaviour of is
 * worse than no rule. No regular expressions, no wildcards, no fuzziness.
 *
 * Two rules decide which one wins when several match: direction first, then
 * length. A longer match is a more specific one, so a rule for
 * "FORTIS ALBERTA GAS" beats a rule for "FORTIS" on a line that contains
 * both — which is the behaviour anybody would expect without being told.
 */

export type Rule = {
  id: string;
  matchText: string;
  direction: "in" | "out";
  category: string | null;
  vendor: string | null;
};

export type RuleHit = {
  rule: Rule;
  /** How many characters matched, for showing why it fired. */
  strength: number;
};

/**
 * The rule that applies to a bank line, if any.
 *
 * Direction is checked before anything else and is never relaxed. A rule
 * written for money going out must not fire on money coming in: a refund from
 * the gas company would otherwise be filed as another gas bill, and the books
 * would show two costs and no refund.
 */
export function ruleFor(
  line: { description: string; amountCents: number },
  rules: Rule[],
): RuleHit | null {
  const direction = line.amountCents < 0 ? "out" : "in";
  const haystack = line.description.toLowerCase();

  const hits = rules
    .filter((r) => r.direction === direction)
    .map((r) => ({ rule: r, needle: r.matchText.trim().toLowerCase() }))
    .filter(({ needle }) => needle.length > 0 && haystack.includes(needle))
    .map(({ rule, needle }) => ({ rule, strength: needle.length }));

  if (hits.length === 0) return null;

  // Longest first; ties broken by id so the answer is stable between loads
  // rather than depending on the order rows came back in.
  hits.sort((a, b) => b.strength - a.strength || a.rule.id.localeCompare(b.rule.id));

  return hits[0];
}

/**
 * A suggested rule from a line she has just categorised.
 *
 * Offered rather than created. The suggestion is the longest run of letters in
 * the description, which is almost always the vendor's name once the bank's
 * reference numbers and its own verbs are stripped out — but "almost always"
 * is exactly why a person confirms it.
 */
export function suggestMatchText(description: string): string {
  const words = description
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const noise = new Set([
    "pre", "auth", "authorised", "authorized", "debit", "credit", "memo",
    "pos", "purchase", "payment", "transfer", "etransfer", "withdrawal",
    "deposit", "bill", "online", "banking", "interac", "the", "and", "ltd",
    "inc", "corp",
  ]);

  const kept = words.filter((w) => !noise.has(w.toLowerCase()));
  if (kept.length === 0) return "";

  // Two words where there are two: one word is often too general ("TOWN"),
  // and the whole string is too specific because it usually ends in a
  // reference number that changes every month.
  return kept.slice(0, 2).join(" ");
}
