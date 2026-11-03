/**
 * Saved messages, and filling in the blanks.
 *
 * The same four or five emails get written over and over — the rent is late,
 * the lease is up for renewal, the plumber is coming on Thursday — and
 * rewriting one from scratch at nine at night is how a sentence comes out
 * sharper than it was meant to. A saved version is a calmer version.
 *
 * The whole risk of a template is the blanks. A message that goes out saying
 * "Hi {{first_name}}" is worse than no message, and one that silently
 * collapses to "Hi ," is worse still, because nothing warned anybody. So
 * filling in is a checked operation: it reports every blank it could not fill
 * and every blank it did not recognise, and the page refuses to send until
 * there are none of either.
 */

export type Placeholder = {
  key: string;
  label: string;
  /** What it looks like, for the list she picks from. */
  example: string;
};

/**
 * Everything a message can refer to.
 *
 * Deliberately a closed list. A template that can reach arbitrary fields is
 * one that can leak a field nobody meant to send.
 */
export const PLACEHOLDERS: Placeholder[] = [
  { key: "name", label: "Their full name", example: "Sarah Kemp" },
  { key: "first_name", label: "Their first name", example: "Sarah" },
  { key: "unit", label: "Which unit", example: "Office 2" },
  { key: "rent", label: "The rent", example: "$1,200.00" },
  { key: "balance", label: "What they owe", example: "$1,200.00" },
  { key: "due_date", label: "When it's due", example: "1 December 2026" },
  { key: "lease_end", label: "When the lease ends", example: "31 August 2027" },
  { key: "today", label: "Today's date", example: "3 November 2026" },
  { key: "landlord", label: "Your name", example: "Tausha" },
  { key: "building", label: "The building", example: "Room Within Community" },
];

const KNOWN = new Set(PLACEHOLDERS.map((p) => p.key));

/** `{{ key }}`, tolerant of spaces inside the braces. */
const BLANK = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export type Filled = {
  text: string;
  /** Recognised blanks with nothing to put in them. */
  missing: string[];
  /** Blanks that aren't a thing — a typo, usually. */
  unknown: string[];
};

/**
 * Put the values into a template.
 *
 * A blank that cannot be filled is left exactly as it was written rather than
 * being emptied. Leaving it visible means the preview shows the problem;
 * emptying it would produce a message that reads almost fine and is wrong in a
 * way nobody notices until it has been sent.
 */
export function fill(text: string, values: Record<string, string>): Filled {
  const missing = new Set<string>();
  const unknown = new Set<string>();

  const out = text.replace(BLANK, (whole, rawKey: string) => {
    const key = rawKey.toLowerCase();

    if (!KNOWN.has(key)) {
      unknown.add(key);
      return whole;
    }

    const value = values[key];
    if (value === undefined || value === "") {
      missing.add(key);
      return whole;
    }

    return value;
  });

  return { text: out, missing: [...missing], unknown: [...unknown] };
}

/** Every blank a template uses, in the order it first uses them. */
export function blanksUsed(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(BLANK)) {
    const key = match[1].toLowerCase();
    if (!found.includes(key)) found.push(key);
  }
  return found;
}

/**
 * A preview with the examples in, for the editing page.
 *
 * Shows what it will look like without needing a real person selected, which
 * is the state she will be in while writing one.
 */
export function previewWith(text: string): Filled {
  const examples = Object.fromEntries(PLACEHOLDERS.map((p) => [p.key, p.example]));
  return fill(text, examples);
}

/**
 * The ones to start with.
 *
 * Written to be sent as they are. A starter template full of CAPITALISED
 * PLACEHOLDER TEXT is one that eventually goes out with the capitals still in
 * it, so these say what they mean and the only blanks are real ones.
 */
export const STARTER_TEMPLATES: {
  name: string;
  subject: string;
  body: string;
}[] = [
  {
    name: "Rent is overdue",
    subject: "Rent for {{unit}}",
    body: `Hello {{first_name}},

I don't think the rent for {{unit}} has come through yet — it was due on {{due_date}} and the balance showing is {{balance}}.

If it's already on its way, ignore this. If something's happened and it's going to be late, tell me rather than not — it's far easier to sort out early.

{{landlord}}
{{building}}`,
  },
  {
    name: "Lease coming up for renewal",
    subject: "Your lease at {{unit}}",
    body: `Hello {{first_name}},

Your lease at {{unit}} runs to {{lease_end}}, so it's about time we talked about what happens next.

I'd be glad to keep you on. Let me know whether you're thinking of staying, and we can sort the paperwork out in good time rather than in a rush.

{{landlord}}
{{building}}`,
  },
  {
    name: "Someone's coming to do a repair",
    subject: "Someone coming to {{unit}}",
    body: `Hello {{first_name}},

Someone's coming to {{unit}} to sort out what you reported. I'll confirm the day as soon as I have it.

They'll knock first. If nobody's in, I'll let them in myself — tell me if you'd rather I didn't.

{{landlord}}
{{building}}`,
  },
  {
    name: "Welcome, once they've moved in",
    subject: "Welcome to {{building}}",
    body: `Hello {{first_name}},

Welcome to {{unit}}. A few things worth knowing now rather than later:

Rent is {{rent}}, due on the first of each month. You can see everything — what's been paid, what's coming up, and anything you've reported — by signing in to your account on the website.

If something breaks, report it there rather than sitting with it. It isn't a bother, and small things get expensive when they wait.

{{landlord}}
{{building}}`,
  },
];
