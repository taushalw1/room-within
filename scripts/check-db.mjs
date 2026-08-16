#!/usr/bin/env node
/**
 * Checks that .env.local is filled in correctly and that the database is
 * reachable, without ever printing a key.
 *
 *   npm run check:db
 *
 * Everything it reports is either a pass/fail or a masked value, so the output
 * is safe to paste to someone for help.
 */
import { readFile } from "node:fs/promises";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const PASS = green("PASS");
const FAIL = red("FAIL");

/** Show enough to tell two keys apart, never enough to use one. */
const mask = (v) =>
  !v ? "(empty)" : v.length < 12 ? "(too short)" : `${v.slice(0, 6)}…${v.slice(-4)} (${v.length} chars)`;

let env;
try {
  env = Object.fromEntries(
    (await readFile(".env.local", "utf8"))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
} catch {
  console.log(`\n${FAIL}  No .env.local file found in this folder.\n`);
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`\n${bold("Checking your Supabase settings")}\n`);

let failed = false;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? PASS : FAIL}  ${label}${detail ? dim("  " + detail) : ""}`);
  if (!ok) failed = true;
};

/* --- 1. Are the three values present and shaped right? ------------------- */

/**
 * The URL must stop at the hostname. Copying it from the API docs panel picks
 * up a trailing "/rest/v1/", and supabase-js appends that path itself — so the
 * request ends up at /rest/v1/rest/v1/ and 404s. Common enough to name it.
 */
function urlProblem(value) {
  if (!value) return "(empty) — should look like https://abcdefgh.supabase.co";
  if (!/^https:\/\//.test(value)) return `${value} — must start with https://`;

  const host = value.replace(/^https:\/\//, "").split("/")[0];
  const trailing = value.replace(/^https:\/\/[^/]+/, "").replace(/\/$/, "");

  if (trailing) {
    return `remove the "${trailing}" from the end — it should just be https://${host}`;
  }
  if (!/\.supabase\.(co|in)$/.test(host)) {
    return `${value} — doesn't look like a Supabase address`;
  }
  return null;
}

const urlIssue = urlProblem(url);
check(urlIssue === null, "Project URL", urlIssue ?? url);
check(Boolean(anon) && anon.length > 20, "Public key", mask(anon));
check(Boolean(service) && service.length > 20, "Secret key", mask(service));

if (anon && service && anon === service) {
  check(false, "The two keys are different", "you've pasted the same one twice");
}

if (failed) {
  console.log(`\n${red("Fix the lines above in .env.local, then run this again.")}\n`);
  process.exit(1);
}

/* --- 2. Can we actually reach the database? ------------------------------ */

async function ping(key, label) {
  try {
    const res = await fetch(`${url}/rest/v1/rooms?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (res.status === 200) {
      const rows = await res.json();
      check(true, label, `connected, ${rows.length ? "found rooms" : "no rooms yet"}`);
      return "ok";
    }

    const body = await res.text();
    if (res.status === 401 || res.status === 403) {
      check(false, label, "key rejected — wrong key, or copied from another project");
    } else if (body.includes("does not exist") || res.status === 404) {
      check(false, label, 'connected, but no "rooms" table — run the migration (step 2)');
      return "no-tables";
    } else {
      check(false, label, `${res.status} ${body.slice(0, 90)}`);
    }
    return "error";
  } catch (e) {
    check(false, label, `couldn't reach it — ${e.message}`);
    return "error";
  }
}

const anonResult = await ping(anon, "Public key works");
const serviceResult = await ping(service, "Secret key works");

/* --- 3. Did the seed run? ------------------------------------------------ */

if (anonResult === "ok") {
  const res = await fetch(`${url}/rest/v1/rooms?select=name`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  if (res.ok) {
    const rooms = await res.json();
    check(
      rooms.length > 0,
      "Starter data loaded",
      rooms.length
        ? `${rooms.length} rooms: ${rooms.map((r) => r.name).join(", ")}`
        : "no rooms — run supabase/seed.sql (step 3)",
    );
  }

  const admins = await fetch(
    `${url}/rest/v1/profiles?select=email&role=eq.admin`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  if (admins.ok) {
    const rows = await admins.json();
    check(
      rows.length > 0,
      "Someone is an admin",
      rows.length
        ? rows.map((r) => r.email).join(", ")
        : "nobody yet — sign in once, then run the update in step 7",
    );
  }
}

console.log(
  failed
    ? `\n${red("Something's not right — see above.")}\n`
    : `\n${green("All good. Restart the app with: npm run dev")}\n`,
);
process.exit(failed ? 1 : 0);
