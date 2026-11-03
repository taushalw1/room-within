#!/usr/bin/env node
/**
 * Verification build.
 *
 * Same checks as `npm run build` — TypeScript, linting, every page compiled —
 * but written to a scratch directory so it can run while `npm run dev` is
 * serving the preview. Building into `.next` underneath a running dev server
 * corrupts it.
 *
 * The service-worker check runs first because it is instant and because the
 * bug it guards against does not show up in a build at all: a stale cached
 * chunk produces a perfectly good deployment that dies in somebody's browser
 * with "Application error" and no way for them to clear it.
 *
 * Use this to check your work. `npm run build` is for deploying.
 */
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

// `node` is an .exe on Windows, `npx` a .cmd — appending .cmd to both finds
// neither.
function run(command, args, env = {}) {
  const binary = isWindows && command !== "node" ? `${command}.cmd` : command;

  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
      shell: isWindows,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const swCode = await run("node", ["scripts/check-sw.mjs"]);
if (swCode !== 0) process.exit(swCode);

// Money arithmetic, against cases with a known answer. Cheap, and the kind of
// thing a build will never catch.
const forecastCode = await run("npx", ["--yes", "tsx", "scripts/check-forecast.mts"]);
if (forecastCode !== 0) process.exit(forecastCode);

// Reading a bank file and matching it. Every failure mode here produces a
// result that looks right — a shifted date column, a flipped sign, a confident
// wrong match — so it is checked against answers worked out by hand.
const reconcileCode = await run("npx", ["--yes", "tsx", "scripts/check-reconcile.mts"]);
if (reconcileCode !== 0) process.exit(reconcileCode);

// The accountant's figures, and the file handed over. A wrong number here is
// one that gets filed, and a cost column a spreadsheet refuses to add up is
// worse than no file at all.
const yearEndCode = await run("npx", ["--yes", "tsx", "scripts/check-year-end.mts"]);
if (yearEndCode !== 0) process.exit(yearEndCode);

const buildCode = await run("npx", ["next", "build"], {
  NEXT_DIST_DIR: ".next-check",
});

process.exit(buildCode);
