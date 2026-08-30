#!/usr/bin/env node
/**
 * Runs a migration file against the Supabase database.
 *
 *   npm run migrate supabase/migrations/0002_welcome_email.sql
 *
 * Uses the Management API, so it needs SUPABASE_ACCESS_TOKEN in .env.local —
 * the same personal access token the template push uses. The service-role key
 * can't do this: it goes through PostgREST, which handles rows, not schema.
 *
 * Migrations here are written to be safe to re-run (IF NOT EXISTS, CREATE OR
 * REPLACE), so running one twice should be harmless. Read the file before
 * running it if you didn't write it.
 */
import { readFile } from "node:fs/promises";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const file = process.argv[2];
if (!file) {
  console.log(`\n${red("Which migration?")}`);
  console.log(dim("  npm run migrate supabase/migrations/0002_welcome_email.sql\n"));
  process.exit(1);
}

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
const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace(/^https:[/][/]/, "")
  .split(".")[0];

if (!token) {
  console.log(`\n${red("SUPABASE_ACCESS_TOKEN is not set in .env.local")}\n`);
  process.exit(1);
}

const sql = await readFile(file, "utf8");

/** Statements, ignoring comment-only lines, purely so we can report a count. */
const statements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

console.log(`\n\x1b[1mRunning ${file} against ${ref}\x1b[0m`);
console.log(dim(`  ${statements.length} statement${statements.length === 1 ? "" : "s"}\n`));

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const text = await res.text();

if (!res.ok) {
  console.log(`  ${red("FAILED")} ${res.status}`);
  console.log(dim(`  ${text.slice(0, 500)}\n`));
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
  process.exit(1);
}

console.log(`  ${green("Applied.")}`);
if (text && text !== "[]" && text.length < 400) console.log(dim(`  ${text}`));
console.log();
