/**
 * Shows what this morning's note would say, without sending it.
 *
 *   npm run preview:morning
 *
 * Reads the real database with the service key, and writes nothing. Late fees
 * are not touched — this only builds the picture.
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { buildDigest, digestAsText } from "../src/lib/digest";

const env = Object.fromEntries(
  (await readFile(new URL("../.env.local", import.meta.url), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("No Supabase details in .env.local — nothing to read.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const digest = await buildDigest(supabase);

console.log(
  `\n  ${digest.quiet ? "Quiet day — no email would be sent." : "An email would go out."}\n`,
);
console.log(digestAsText(digest));
console.log();
