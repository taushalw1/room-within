/**
 * Checks the one rule the service worker's asset cache turns on.
 *
 *   npm run check:sw
 *
 * A file whose name carries a content hash can be cached forever, because
 * changing the file changes the name. A file served at a fixed path cannot,
 * and caching one of those is how somebody ends up looking at "Application
 * error" with yesterday's JavaScript and no way to clear it. The rule lives in
 * public/sw.js; this reads it from there rather than restating it, so the two
 * cannot drift.
 */
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

const match = source.match(/function isImmutable\(pathname\) \{\s*return (.+?);\s*\}/s);
if (!match) {
  console.error("Couldn't find isImmutable in public/sw.js.");
  process.exit(1);
}

const isImmutable = new Function("pathname", `return ${match[1]};`);

const cases = [
  // Route chunks: a fixed path whose contents change with every build.
  ["/_next/static/chunks/app/(admin)/admin/rentals/page.js", false],
  ["/_next/static/chunks/app/(site)/portal/page.js", false],
  ["/_next/static/chunks/main-app.js", false],
  ["/_next/static/chunks/webpack.js", false],
  ["/_next/static/aBcD1234efGH/_buildManifest.js", false],
  ["/icons/icon-192.png", false],
  ["/logo-lockup.png", false],
  // Fingerprinted: safe forever.
  ["/_next/static/chunks/1255-a20f6c5e797a687b.js", true],
  ["/_next/static/chunks/app/(admin)/admin/rentals/page-9f3c2a1b8d7e6f50.js", true],
  ["/_next/static/css/f3b2c1d4e5a6b7c8.css", true],
  ["/_next/static/media/lora.12ab34cd.woff2", true],
];

let bad = 0;
for (const [path, want] of cases) {
  const got = Boolean(isImmutable(path));
  if (got !== want) {
    bad++;
    console.log(`  WRONG  ${path}\n         treated as ${got ? "immutable" : "revalidated"}, should be ${want ? "immutable" : "revalidated"}`);
  } else {
    console.log(`  ok     ${got ? "cache forever" : "always re-check"}  ${path}`);
  }
}

console.log(bad === 0 ? "\n  The asset cache rule holds.\n" : "\n  SOMETHING IS WRONG.\n");
if (bad > 0) process.exit(1);
