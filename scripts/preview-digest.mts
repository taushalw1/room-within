/** Renders the Monday grant summary to .email-preview/ without sending it. */
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), ".email-preview");
process.env.NODE_ENV = "development";
process.env.EMAIL_PREVIEW_DIR = DIR;
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const { sendGrantDigest } = await import("../src/lib/email/send.ts");

await sendGrantDigest({
  to: "someone@example.com",
  grants: [
    {
      title: "Main Street heritage restoration fund",
      organisation: "A heritage foundation",
      amount: "$2,500 – $50,000",
      deadline: "2026-11-20",
      deadlineNote: "18 days left",
      urgent: false,
      url: "https://example.ca",
      why: "A 1905 building on a main street is the archetype for this fund.",
    },
    {
      title: "Community Facility Enhancement Program — Small",
      organisation: "Government of Alberta",
      amount: "Up to $125,000",
      deadline: "2026-11-09",
      deadlineNote: "7 days left",
      urgent: true,
      url: "https://example.ca",
      why: "Matching capital grant for community-use facilities. They pay 50%.",
    },
  ],
  closingSoon: [
    { title: "CIP Project Grant", deadlineNote: "12 days left" },
    { title: "Rural professional development bursary", deadlineNote: "Closes tomorrow" },
  ],
});

console.log(`written to ${DIR}`);
