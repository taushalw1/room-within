#!/usr/bin/env node
/**
 * Checks that email sending is set up, without printing the API key.
 *
 *   npm run check:email                  verify the key and list domains
 *   npm run check:email you@example.com  also send a test message there
 */
import { readFile } from "node:fs/promises";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const PASS = green("PASS");
const FAIL = red("FAIL");

let env = {};
try {
  env = Object.fromEntries(
    (await readFile(".env.local", "utf8"))
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
} catch {
  console.log(`\n${FAIL}  No .env.local found.\n`);
  process.exit(1);
}

const key = env.RESEND_API_KEY;
const from = env.EMAIL_FROM;
const to = process.argv[2];

console.log("\n\x1b[1mChecking email setup\x1b[0m\n");

if (!key) {
  console.log(`  ${FAIL}  RESEND_API_KEY is empty`);
  console.log(dim("\n  Nothing will send until this is set. Reminder emails will"));
  console.log(dim("  silently do nothing — the job runs and reports 0 sent.\n"));
  process.exit(1);
}
console.log(`  ${PASS}  RESEND_API_KEY present ${dim(`${key.slice(0, 6)}…(${key.length} chars)`)}`);

const api = async (path, init) =>
  fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
  });

/* --- Is the key valid, and which domains can we send from? --------------- */

const res = await api("/domains");
if (res.status === 401) {
  console.log(`  ${FAIL}  Resend rejected the key — wrong or revoked`);
  process.exit(1);
}
if (!res.ok) {
  console.log(`  ${FAIL}  Resend returned ${res.status}`);
  process.exit(1);
}

const { data: domains = [] } = await res.json();
const verified = domains.filter((d) => d.status === "verified");

console.log(`  ${PASS}  Key accepted by Resend`);

if (domains.length === 0) {
  console.log(`  ${FAIL}  No sending domain added`);
  console.log(dim("\n  Without one, Resend only delivers to your own account address."));
  console.log(dim("  Tenants would never receive a reminder. You need a domain you"));
  console.log(dim("  control the DNS for — a netlify.app subdomain can't be used.\n"));
} else {
  for (const d of domains) {
    const ok = d.status === "verified";
    console.log(`  ${ok ? PASS : FAIL}  Domain ${d.name} ${dim(`(${d.status}, ${d.region})`)}`);
  }
}

/* --- Does EMAIL_FROM match a verified domain? ---------------------------- */

if (!from) {
  console.log(`  ${FAIL}  EMAIL_FROM is empty — falls back to Resend's sandbox sender`);
} else {
  const addr = from.match(/<(.+)>/)?.[1] ?? from;
  const domain = addr.split("@")[1];
  const matches = verified.some((d) => d.name === domain);
  console.log(
    `  ${matches ? PASS : FAIL}  EMAIL_FROM uses ${domain}` +
      dim(matches ? "  (verified)" : "  — not a verified domain, sending will fail"),
  );
}

/* --- Optionally send a real test ---------------------------------------- */

if (!to) {
  console.log(dim("\n  To send a test message:  npm run check:email -- you@example.com\n"));
  process.exit(verified.length ? 0 : 1);
}

console.log(`\n  Sending a test message to ${to} …`);

const send = await api("/emails", {
  method: "POST",
  body: JSON.stringify({
    from: from || "Room Within <onboarding@resend.dev>",
    to,
    subject: "Room Within — email test",
    text:
      "This is a test from the Room Within app.\n\n" +
      "If you're reading this, reminder emails to tenants will send correctly.",
  }),
});

const body = await send.json();
if (send.ok) {
  console.log(`  ${PASS}  Sent ${dim(`(id ${body.id})`)}`);
  console.log(dim("\n  Check the inbox. If it doesn't arrive, look at the Resend"));
  console.log(dim("  dashboard's Emails tab — it shows bounces and blocks.\n"));
} else {
  console.log(`  ${FAIL}  ${body.message ?? send.status}`);
  console.log(dim("\n  A 'domain is not verified' error means EMAIL_FROM points at a"));
  console.log(dim("  domain Resend hasn't confirmed you own.\n"));
  process.exit(1);
}
