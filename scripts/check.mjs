#!/usr/bin/env node
/**
 * Verification build.
 *
 * Same checks as `npm run build` — TypeScript, linting, every page compiled —
 * but written to a scratch directory so it can run while `npm run dev` is
 * serving the preview. Building into `.next` underneath a running dev server
 * corrupts it.
 *
 * Use this to check your work. `npm run build` is for deploying.
 */
import { spawn } from "node:child_process";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: ".next-check" },
    shell: process.platform === "win32",
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
