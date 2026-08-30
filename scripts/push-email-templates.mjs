#!/usr/bin/env node
/**
 * Uploads the email templates in supabase/email-templates/ to Supabase.
 *
 *   npm run push:templates
 *
 * Pasting HTML into the dashboard by hand is easy to get wrong — into the
 * preview instead of the source box, into the wrong template, or saved without
 * the change taking. This pushes both templates straight to the project so the
 * files in the repo are the single source of truth.
 *
 * Needs a Supabase personal access token in .env.local:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Create one at https://supabase.com/dashboard/account/tokens — it is NOT the
 * service-role key. It is account-level and can change project settings, so
 * treat it like a password; .env.local is gitignored and stays on your machine.
 */
import { readFile } from "node:fs/promises";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace(/^https:[/][/]/, "")
  .split(".")[0];

if (!token) {
  console.log(`\n${red("SUPABASE_ACCESS_TOKEN is not set in .env.local")}`);
  console.log(dim("\n  Create one at https://supabase.com/dashboard/account/tokens"));
  console.log(dim("  then add this line to .env.local:\n"));
  console.log("    SUPABASE_ACCESS_TOKEN=sbp_your_token_here\n");
  process.exit(1);
}
if (!projectRef) {
  console.log(`\n${red("Couldn't work out the project ref from NEXT_PUBLIC_SUPABASE_URL")}\n`);
  process.exit(1);
}

/**
 * Which file maps to which template. The API field names are fixed by
 * Supabase; `type` in each link must match what the callback verifies.
 */
const TEMPLATES = [
  {
    file: "confirm-signup.html",
    label: "Confirm signup",
    subjectField: "mailer_subjects_confirmation",
    bodyField: "mailer_templates_confirmation_content",
    subject: "Welcome to Room Within Community",
    sentTo: "someone signing in for the first time",
  },
  {
    file: "magic-link.html",
    label: "Magic Link",
    subjectField: "mailer_subjects_magic_link",
    bodyField: "mailer_templates_magic_link_content",
    subject: "Your sign-in link — Room Within Community",
    sentTo: "everyone after that",
  },
];

console.log(`\n\x1b[1mPushing email templates to ${projectRef}\x1b[0m\n`);

const body = {};
for (const t of TEMPLATES) {
  const html = await readFile(`supabase/email-templates/${t.file}`, "utf8");

  // Guard against uploading the broken default path by accident.
  if (html.includes("/auth/v1/verify")) {
    console.log(`  ${red("FAIL")}  ${t.label} — points at /auth/v1/verify, which 404s`);
    process.exit(1);
  }
  if (!html.includes("{{ .TokenHash }}")) {
    console.log(`  ${red("FAIL")}  ${t.label} — no TokenHash in the link`);
    process.exit(1);
  }

  body[t.bodyField] = html;
  body[t.subjectField] = t.subject;
  console.log(`  ${t.label.padEnd(16)} ${dim(`${html.length} bytes, sent to ${t.sentTo}`)}`);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

if (!res.ok) {
  const text = await res.text();
  console.log(`\n  ${red("FAILED")} ${res.status}`);
  console.log(dim(`  ${text.slice(0, 300)}\n`));
  if (res.status === 403) {
    console.log(dim("  A 403 means the token is valid, but the Supabase account it"));
    console.log(dim("  belongs to is not a member of the organisation that owns this"));
    console.log(dim("  project — or is a member without admin rights."));
    console.log(dim(""));
    console.log(dim("  Fix: the organisation owner invites that account from the"));
    console.log(dim("  Supabase dashboard, Organisation settings, Team, as Owner or"));
    console.log(dim("  Administrator. Then this works with no change here. Nothing on"));
    console.log(dim("  the live site is affected — this only blocks setup tooling."));
    console.log();
  }
  if (res.status === 401) {
    console.log(dim("  A 401 means the token is wrong, or it's the service-role"));
    console.log(dim("  key rather than a personal access token (sbp_...).\n"));
  }
  process.exit(1);
}

/* Read the config back, so this reports what Supabase actually stored. */
const check = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const saved = check.ok ? await check.json() : null;

console.log();
for (const t of TEMPLATES) {
  const live = saved?.[t.bodyField] ?? "";
  const ok = live.includes("/auth/callback") && !live.includes("/auth/v1/verify");
  console.log(`  ${ok ? green("PASS") : red("FAIL")}  ${t.label} live in Supabase`);
}

console.log(green("\n  Done. Test with an address you haven't used before.\n"));
