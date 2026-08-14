import { Resend } from "resend";
import { moneyExact, dateLong } from "@/lib/format";
import { site } from "@/lib/site";

/**
 * Email sending, via Resend.
 *
 * If `RESEND_API_KEY` isn't set, nothing is sent and the call reports back
 * clearly rather than throwing — so the app works end-to-end before email is
 * configured.
 */

const FROM =
  process.env.EMAIL_FROM ?? "Room Within Community <onboarding@resend.dev>";

const REPLY_TO = process.env.EMAIL_REPLY_TO ?? site.email;

function client() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

type SendResult = { ok: boolean; message: string };

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    return {
      ok: false,
      message:
        "Email isn't set up yet — no message was sent. (Tyler: add RESEND_API_KEY.)",
    };
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    replyTo: REPLY_TO,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Sent." };
}

/* -------------------------------------------------------------------------
   Shared HTML shell — kept deliberately simple, since email clients are not
   web browsers. Inline styles only, tables where layout matters.
   ------------------------------------------------------------------------- */

function shell(heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3eee0;font-family:Georgia,'Times New Roman',serif;color:#3a372f;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#faf6ec;border:1px solid #e0d5bd;border-radius:6px">
    <tr><td style="padding:28px 32px 8px">
      <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7a6647">Room Within Community</p>
      <h1 style="margin:12px 0 0;font-size:24px;font-weight:600;color:#414d30">${heading}</h1>
    </td></tr>
    <tr><td style="padding:8px 32px 24px;font-size:15px">${body}</td></tr>
    ${
      cta
        ? `<tr><td style="padding:0 32px 28px">
             <a href="${cta.url}" style="display:inline-block;background:#5e6e45;color:#faf6ec;text-decoration:none;padding:12px 24px;border-radius:5px;font-size:12px;letter-spacing:2px;text-transform:uppercase">${cta.label}</a>
           </td></tr>`
        : ""
    }
    <tr><td style="padding:16px 32px 28px;border-top:1px solid #e0d5bd;font-size:12px;color:#6b6659">
      ${site.name}<br>${site.address.oneLine}<br>
      <a href="mailto:${site.email}" style="color:#7c2e3e">${site.email}</a>
    </td></tr>
  </table>
</body></html>`;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/* ------------------------------- Templates ------------------------------- */

export async function sendInvoiceReminder(opts: {
  to: string;
  name: string;
  invoiceNumber: string;
  description: string;
  dueDate: string;
  balanceCents: number;
  daysOverdue: number;
}): Promise<SendResult> {
  const late = opts.daysOverdue > 0;

  const heading = late ? "A friendly reminder" : "Coming up";
  const opener = late
    ? `This is a gentle nudge that <strong>${moneyExact(opts.balanceCents)}</strong> for ${opts.description} was due on ${dateLong(opts.dueDate)} — ${opts.daysOverdue} day${opts.daysOverdue === 1 ? "" : "s"} ago.`
    : `Just a note that <strong>${moneyExact(opts.balanceCents)}</strong> for ${opts.description} is due on ${dateLong(opts.dueDate)}.`;

  const body = `
    <p>Hello ${opts.name},</p>
    <p>${opener}</p>
    <p style="margin:20px 0;padding:14px 18px;background:#e3e7d5;border-radius:5px">
      <strong>Invoice ${opts.invoiceNumber}</strong><br>
      ${opts.description}<br>
      Amount owing: <strong>${moneyExact(opts.balanceCents)}</strong>
    </p>
    <p>If you've already sent this, thank you — please ignore this note. And if
    something's made paying difficult right now, just reply to this email and
    we'll work it out together.</p>
    <p>Warmly,<br>Tausha</p>`;

  const text = `Hello ${opts.name},

${late ? `A reminder that ${moneyExact(opts.balanceCents)} for ${opts.description} was due on ${dateLong(opts.dueDate)}.` : `${moneyExact(opts.balanceCents)} for ${opts.description} is due on ${dateLong(opts.dueDate)}.`}

Invoice ${opts.invoiceNumber} — ${moneyExact(opts.balanceCents)}

If you've already sent this, please ignore this note. If paying is difficult right now, just reply and we'll work it out.

Warmly,
Tausha
${site.name}, ${site.town}`;

  return send({
    to: opts.to,
    subject: late
      ? `Reminder — ${opts.description} (${opts.invoiceNumber})`
      : `Due soon — ${opts.description} (${opts.invoiceNumber})`,
    html: shell(heading, body, {
      label: "View in the portal",
      url: `${SITE_URL}/portal`,
    }),
    text,
  });
}

export async function sendBookingReceived(opts: {
  to: string;
  name: string;
  roomName: string;
  when: string;
  needsApproval: boolean;
}): Promise<SendResult> {
  const body = `
    <p>Hello ${opts.name},</p>
    <p>Thank you — we've received your request for <strong>${opts.roomName}</strong> on ${opts.when}.</p>
    <p>${
      opts.needsApproval
        ? "Tausha will look it over and confirm shortly, usually within a day. You'll get another email once it's confirmed."
        : "Your booking is confirmed and is now in the calendar."
    }</p>
    <p>Warmly,<br>Tausha</p>`;

  return send({
    to: opts.to,
    subject: `${opts.needsApproval ? "Request received" : "Booking confirmed"} — ${opts.roomName}`,
    html: shell(
      opts.needsApproval ? "We've got your request" : "You're booked in",
      body,
    ),
    text: `Hello ${opts.name},\n\nWe've received your request for ${opts.roomName} on ${opts.when}.\n\n${opts.needsApproval ? "Tausha will confirm shortly." : "Your booking is confirmed."}\n\nWarmly,\nTausha`,
  });
}

export async function sendBookingConfirmed(opts: {
  to: string;
  name: string;
  roomName: string;
  when: string;
}): Promise<SendResult> {
  const body = `
    <p>Hello ${opts.name},</p>
    <p>Your booking of <strong>${opts.roomName}</strong> on ${opts.when} is confirmed. We look forward to having you.</p>
    <p>If anything changes, just reply to this email.</p>
    <p>Warmly,<br>Tausha</p>`;

  return send({
    to: opts.to,
    subject: `Confirmed — ${opts.roomName}, ${opts.when}`,
    html: shell("You're booked in", body, {
      label: "Add to your calendar",
      url: `${SITE_URL}/calendar/subscribe`,
    }),
    text: `Hello ${opts.name},\n\nYour booking of ${opts.roomName} on ${opts.when} is confirmed.\n\nWarmly,\nTausha`,
  });
}

export async function sendCounsellingRequestAck(opts: {
  to: string;
  name: string;
}): Promise<SendResult> {
  const body = `
    <p>Hello ${opts.name},</p>
    <p>Thank you for reaching out. I've received your message and I'll be in
    touch personally within a couple of working days to find a time that suits
    you.</p>
    <p>If this is urgent, or you need to speak with someone right away, please
    contact the Alberta Mental Health Help Line on <strong>1-877-303-2642</strong>
    (24 hours), or call 911 in an emergency.</p>
    <p>Warmly,<br>Tausha</p>`;

  return send({
    to: opts.to,
    subject: "Thank you for getting in touch",
    html: shell("Your message has arrived", body),
    text: `Hello ${opts.name},\n\nThank you for reaching out. I've received your message and will be in touch within a couple of working days.\n\nIf this is urgent, please call the Alberta Mental Health Help Line on 1-877-303-2642 (24 hours), or 911 in an emergency.\n\nWarmly,\nTausha`,
  });
}

/** Internal heads-up to Tausha when something new comes in. */
export async function notifyAdmin(opts: {
  subject: string;
  heading: string;
  bodyHtml: string;
  ctaPath?: string;
}): Promise<SendResult> {
  return send({
    to: process.env.ADMIN_EMAIL ?? site.email,
    subject: opts.subject,
    html: shell(
      opts.heading,
      opts.bodyHtml,
      opts.ctaPath
        ? { label: "Open the admin area", url: `${SITE_URL}${opts.ctaPath}` }
        : undefined,
    ),
    text: opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });
}
