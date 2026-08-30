/**
 * Renders every email to an HTML file so the design can be looked at.
 *
 *   npm run preview:emails
 *
 * Nothing is sent. The files land in .email-preview/, which is ignored by git.
 */
import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), ".email-preview");

process.env.NODE_ENV = "development";
process.env.EMAIL_PREVIEW_DIR = DIR;

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const m = await import("../src/lib/email/send.ts");

await m.sendWelcome({ to: "someone@example.com", name: "Sarah" });

await m.sendDonationThanks({
  to: "someone@example.com",
  name: "Sarah",
  amountCents: 25000,
});

await m.sendInvoiceReminder({
  to: "someone@example.com",
  name: "Sarah",
  invoiceNumber: "INV-0042",
  description: "Rent — Suite 2, March",
  dueDate: "2026-03-01",
  balanceCents: 65000,
  daysOverdue: 4,
});

await m.sendInvoiceReminder({
  to: "someone@example.com",
  name: "Sarah",
  invoiceNumber: "INV-0043",
  description: "Rent — Suite 2, April",
  dueDate: "2026-04-01",
  balanceCents: 65000,
  daysOverdue: 0,
});

await m.sendBookingReceived({
  to: "someone@example.com",
  name: "Sarah",
  roomName: "The Gathering Room",
  when: "Saturday 14 March, 1:00–4:00pm",
  needsApproval: true,
});

await m.sendBookingConfirmed({
  to: "someone@example.com",
  name: "Sarah",
  roomName: "The Gathering Room",
  when: "Saturday 14 March, 1:00–4:00pm",
});

await m.sendCounsellingRequestAck({
  to: "someone@example.com",
  name: "Sarah",
});

await m.notifyAdmin({
  subject: "Donation received — example",
  heading: "A donation has come in",
  bodyHtml: '<p style="margin:0 0 14px;"><strong>$250.00</strong> from Sarah.</p>',
  ctaPath: "/admin/finance",
});

const files = readdirSync(DIR).filter((f) => f.endsWith(".html")).sort();

writeFileSync(
  `${DIR}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Emails</title>
<body style="margin:0;font:16px Georgia,serif;background:#f3eee0;color:#3a372f;">
<div style="max-width:760px;margin:0 auto;padding:40px 20px;">
<h1 style="font-weight:normal;color:#414d30;">Every email, as it arrives</h1>
<p style="color:#6b6659;">Nothing here was sent to anyone.</p>
${files
  .map(
    (f) => `<h2 style="font-weight:normal;font-size:18px;color:#414d30;margin:36px 0 8px;">${f.replace(/-/g, " ").replace(".html", "")}</h2>
<iframe src="./${f}" style="width:100%;height:900px;border:1px solid #e6dcc6;border-radius:8px;background:#fff;"></iframe>`,
  )
  .join("\n")}
</div></body>`,
);

console.log(`${files.length} emails written to ${DIR}`);
console.log(`Open ${DIR}/index.html`);
