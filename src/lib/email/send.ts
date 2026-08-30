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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4300";

/**
 * Where images in emails load from — always the live site, even when running
 * locally. A localhost URL in an email is a broken image in every inbox that
 * receives it.
 */
const ASSETS = "https://roomwithin.ca";

function client() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export type SendResult = { ok: boolean; message: string };

/**
 * Local preview escape hatch.
 *
 * When `EMAIL_PREVIEW_DIR` is set on a development machine, messages are
 * written to disk as HTML files instead of being sent, so the design can be
 * looked at in a browser. Guarded on NODE_ENV as well as the variable itself,
 * so it can never divert real mail from the live site.
 */
function previewDir(): string | null {
  const dir = process.env.EMAIL_PREVIEW_DIR;
  return dir && process.env.NODE_ENV === "development" ? dir : null;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const dir = previewDir();
  if (dir) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const slug = opts.subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${slug}.html`, opts.html);
    return { ok: true, message: `Written to ${dir} for preview — not sent.` };
  }

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
   The frame every email sits in.

   Built as nested tables with inline styles because email clients are not web
   browsers: no flexbox, no grid, no external stylesheets, and Outlook renders
   through Word. The constraints that shape this:
     - tables for layout, never divs
     - every style inline, nothing in a <style> block
     - 600px maximum width
     - web fonts don't load, so Georgia with a serif fallback
     - the logo carries an explicit width or Outlook stretches it
   ------------------------------------------------------------------------- */

type Cta = { label: string; url: string };

function button(cta: Cta) {
  return `
        <tr><td align="center" style="padding:28px 40px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#5e6e45" style="border-radius:5px;">
              <a href="${cta.url}" style="display:inline-block;padding:13px 30px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:2.4px;text-transform:uppercase;color:#faf6ec;text-decoration:none;">${cta.label}</a>
            </td>
          </tr></table>
        </td></tr>`;
}

function shell(
  heading: string,
  body: string,
  opts?: {
    cta?: Cta;
    /** The grey line shown after the subject in an inbox list. */
    preview?: string;
  },
) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f3eee0;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${opts?.preview ?? ""}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3eee0;">
    <tr><td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#faf6ec;border:1px solid #e6dcc6;border-radius:8px;">

        <tr><td align="center" style="padding:34px 32px 0;">
          <img src="${ASSETS}/logo-lockup.png" width="176" alt="Room Within Community"
               style="display:block;border:0;width:176px;height:auto;">
        </td></tr>

        <tr><td align="center" style="padding:26px 40px 0;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.25;font-weight:normal;color:#414d30;">${heading}</h1>
        </td></tr>

        <tr><td style="padding:22px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="border-top:1px solid #e6dcc6;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:22px 40px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#3a372f;">
          ${body}
        </td></tr>
${opts?.cta ? button(opts.cta) : ""}
        <tr><td style="padding:34px 40px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid #e6dcc6;padding-top:20px;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:#6b6659;">
              <strong style="color:#414d30;">${site.name}</strong><br>
              ${site.address.oneLine}<br>
              <a href="mailto:${site.email}" style="color:#7c2e3e;text-decoration:none;">${site.email}</a>
            </td></tr>
          </table>
        </td></tr>

      </table>

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
        <tr><td align="center" style="padding:18px 24px 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.6;color:#9a9281;">
          ${site.logoTagline}
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Sign-off used on every message, so they read as one voice. */
const SIGNOFF = `<p style="margin:18px 0 0;">Warmly,<br><strong style="color:#414d30;">Tausha</strong></p>`;

const P = (t: string) => `<p style="margin:0 0 14px;">${t}</p>`;

/** A tinted callout box — used for amounts owed and for crisis information. */
const NOTE = (inner: string, tone: "sage" | "blush" = "sage") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 14px;">
     <tr><td style="padding:14px 18px;background:${tone === "sage" ? "#e3e7d5" : "#f0e2e2"};border-radius:5px;font-size:15px;color:#3a372f;">
       ${inner}
     </td></tr>
   </table>`;

/* ------------------------------- Templates ------------------------------- */

/**
 * Sent once, the first time someone signs in and their account is created.
 * Deliberately short: it says what the account is for, and gets out of the way.
 */
export async function sendWelcome(opts: {
  to: string;
  name?: string | null;
}): Promise<SendResult> {
  const greeting = opts.name ? `Hello ${opts.name},` : "Hello,";

  const body = `
    ${P(greeting)}
    ${P(`Welcome to ${site.name}. Your account is ready, and you can sign in any time with your email address — there's no password to remember.`)}
    ${NOTE(`
      <strong style="color:#414d30;">Book a room</strong><br>
      By the hour, half day or full day, with the calendar showing what's free.
      <br><br>
      <strong style="color:#414d30;">See what's on</strong><br>
      Everything happening here and around Grassy Lake — and you can add it to
      your own calendar.
      <br><br>
      <strong style="color:#414d30;">Keep track of anything you owe</strong><br>
      Rent and room bookings, all in one place.
    `)}
    ${P("If you have any questions at all, just reply to this message — it comes straight to us.")}
    ${SIGNOFF}`;

  const text = `${greeting}

Welcome to ${site.name}. Your account is ready, and you can sign in any time with your email address — there's no password to remember.

With it you can book a room, see what's on and add it to your own calendar, and keep track of anything you owe.

If you have any questions, just reply to this message.

Warmly,
Tausha
${site.name}
${site.address.oneLine}`;

  return send({
    to: opts.to,
    subject: `Welcome to ${site.name}`,
    html: shell(`Welcome to ${site.shortName}`, body, {
      preview: "Your account is ready — here's what you can do with it.",
      cta: { label: "Visit the website", url: SITE_URL },
    }),
    text,
  });
}

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

  const opener = late
    ? `This is a gentle nudge that <strong>${moneyExact(opts.balanceCents)}</strong> for ${opts.description} was due on ${dateLong(opts.dueDate)} — ${opts.daysOverdue} day${opts.daysOverdue === 1 ? "" : "s"} ago.`
    : `Just a note that <strong>${moneyExact(opts.balanceCents)}</strong> for ${opts.description} is due on ${dateLong(opts.dueDate)}.`;

  const body = `
    ${P(`Hello ${opts.name},`)}
    ${P(opener)}
    ${NOTE(`
      <strong style="color:#414d30;">Invoice ${opts.invoiceNumber}</strong><br>
      ${opts.description}<br>
      <span style="font-size:19px;color:#414d30;">${moneyExact(opts.balanceCents)}</span>
    `)}
    ${P("If you've already sent this, thank you — please ignore this note. And if something's made paying difficult right now, just reply to this email and we'll work it out together.")}
    ${SIGNOFF}`;

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
    html: shell(late ? "A friendly reminder" : "Coming up", body, {
      preview: `${moneyExact(opts.balanceCents)} for ${opts.description}`,
      cta: { label: "View in the portal", url: `${SITE_URL}/portal` },
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
    ${P(`Hello ${opts.name},`)}
    ${P(`Thank you — we've received your request for <strong>${opts.roomName}</strong> on ${opts.when}.`)}
    ${P(
      opts.needsApproval
        ? "Tausha will look it over and confirm shortly, usually within a day. You'll get another email once it's confirmed."
        : "Your booking is confirmed and is now in the calendar.",
    )}
    ${SIGNOFF}`;

  return send({
    to: opts.to,
    subject: `${opts.needsApproval ? "Request received" : "Booking confirmed"} — ${opts.roomName}`,
    html: shell(
      opts.needsApproval ? "We've got your request" : "You're booked in",
      body,
      { preview: `${opts.roomName}, ${opts.when}` },
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
    ${P(`Hello ${opts.name},`)}
    ${P(`Your booking of <strong>${opts.roomName}</strong> on ${opts.when} is confirmed. We look forward to having you.`)}
    ${P("If anything changes, just reply to this email.")}
    ${SIGNOFF}`;

  return send({
    to: opts.to,
    subject: `Confirmed — ${opts.roomName}, ${opts.when}`,
    html: shell("You're booked in", body, {
      preview: `${opts.roomName}, ${opts.when}`,
      cta: {
        label: "Add to your calendar",
        url: `${SITE_URL}/calendar/subscribe`,
      },
    }),
    text: `Hello ${opts.name},\n\nYour booking of ${opts.roomName} on ${opts.when} is confirmed.\n\nWarmly,\nTausha`,
  });
}

export async function sendCounsellingRequestAck(opts: {
  to: string;
  name: string;
}): Promise<SendResult> {
  const body = `
    ${P(`Hello ${opts.name},`)}
    ${P("Thank you for reaching out. I've received your message and I'll be in touch personally within a couple of working days to find a time that suits you.")}
    ${NOTE(
      `If this is urgent, or you need to speak with someone right away, please
       contact the <strong>Alberta Mental Health Help Line</strong> on
       <strong>1-877-303-2642</strong> — free, confidential, 24 hours. In an
       emergency, call <strong>911</strong>.`,
      "blush",
    )}
    ${SIGNOFF}`;

  return send({
    to: opts.to,
    subject: "Thank you for getting in touch",
    html: shell("Your message has arrived", body, {
      preview: "Tausha will be in touch within a couple of working days.",
    }),
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
    html: shell(opts.heading, opts.bodyHtml, {
      cta: opts.ctaPath
        ? { label: "Open the admin area", url: `${SITE_URL}${opts.ctaPath}` }
        : undefined,
    }),
    text: opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });
}

/**
 * Sent to a donor once Stripe confirms the payment.
 *
 * Two things this has to get right. It thanks them for the amount they
 * actually gave, not a rounded or presumed figure — and it repeats, in the
 * same breath as the amount, that Room Within is not a registered charity.
 * Somebody filing a return next spring should not have to guess.
 */
export async function sendDonationThanks(opts: {
  to: string;
  name?: string | null;
  amountCents: number;
}): Promise<SendResult> {
  const greeting = opts.name ? `Hello ${opts.name},` : "Hello,";
  const amount = moneyExact(opts.amountCents);

  const body = `
    ${P(greeting)}
    ${P(`Thank you. Your donation of <strong>${amount}</strong> has come through, and it goes straight into buying and repairing the building — nothing is taken out along the way.`)}
    ${NOTE(`
      <strong style="color:#414d30;">Your donation</strong><br>
      <span style="font-size:19px;color:#414d30;">${amount}</span><br>
      Towards purchasing and restoring the 1905 building on Chamberlain Avenue.
      <br><br>
      Room Within Community is not a registered charity, so this is not a
      tax-deductible gift and there is no charitable receipt. This email is
      your record of it.
    `)}
    ${P("A building this old is mended one repair at a time, and every one of them is somebody choosing to help. We'll keep the community posted as the work goes on.")}
    ${P("If you'd like your gift kept private, or you'd rather we didn't mention it at all, just reply and say so — that's completely fine.")}
    ${SIGNOFF}`;

  const text = `${greeting}

Thank you. Your donation of ${amount} has come through, and it goes straight into buying and repairing the building.

Your donation: ${amount}
Towards purchasing and restoring the 1905 building on Chamberlain Avenue.

Room Within Community is not a registered charity, so this is not a tax-deductible gift and there is no charitable receipt. This email is your record of it.

If you'd like your gift kept private, just reply and say so.

Warmly,
Tausha
${site.name}
${site.address.oneLine}`;

  return send({
    to: opts.to,
    subject: `Thank you — your donation of ${amount}`,
    html: shell("Thank you", body, {
      preview: `Your donation of ${amount} has come through.`,
      cta: { label: "See the project", url: `${SITE_URL}/support` },
    }),
    text,
  });
}
