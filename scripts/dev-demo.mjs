#!/usr/bin/env node
/**
 * Runs the site in demo mode on a second port.
 *
 *   npm run dev:demo     →  http://localhost:4310
 *
 * Why this exists. The admin pages render on demand, so `npm run check` never
 * exercises them — it compiles them and moves on. And they need a real signed-in
 * admin, so they can't be opened locally either, because the sign-in link points
 * at the live site. That combination let a page ship that threw the moment it
 * was opened.
 *
 * Demo mode is the existing escape hatch: with no Supabase configured, the
 * admin area opens without a login and shows the sample content. This blanks
 * the Supabase variables for the child process only — .env.local is not
 * touched, and neither Node nor Next overrides a variable that is already set,
 * so the empty values win.
 *
 * Nothing here can reach the real database, which is the point: it is a place
 * to look at every page without a login and without risk.
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const PORT = process.env.DEMO_PORT ?? "4310";
const DIST = ".next-demo";

/**
 * Start from a clean build directory every time.
 *
 * A half-written build directory doesn't announce itself: the server compiles
 * without complaint and the page then dies in the browser with "Cannot read
 * properties of undefined (reading 'call')", which looks exactly like a broken
 * component and sent a whole afternoon chasing one. This directory is
 * disposable and demo-only, so the cheapest cure is to never reuse it.
 */
rmSync(DIST, { recursive: true, force: true });

const env = {
  ...process.env,
  NODE_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  // A separate build directory, so this never disturbs the main dev server.
  NEXT_DIST_DIR: DIST,
};

console.log(`\n  Demo mode — no database, no login, sample content.`);
console.log(`  http://localhost:${PORT}/admin\n`);

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--port", PORT],
  { env, stdio: "inherit", shell: process.platform === "win32" },
);

child.on("exit", (code) => process.exit(code ?? 0));
