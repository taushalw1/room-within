# Setup — for Tyler

The app runs right now with no setup at all: `npm run dev` starts it in demo
mode with sample data, and `/admin` opens without a login. Everything below is
about making it real.

Do these in order. Each step works on its own — the app keeps running whether
or not you've done the next one.

---

## 1. Run it locally

```bash
npm install && npm run dev
```

Open http://localhost:3000 for the public site and http://localhost:3000/admin
for Tausha's side.

---

## 2. Put it in Git

```bash
git init && git add -A && git commit -m "Room Within: initial app"
```

Then create an empty repo on GitHub and push to it. This matters more than it
looks: `/publish` in Tausha's window is a `git push`, and Vercel deploying on
push is what makes that work.

---

## 3. Supabase

1. Create a project at [supabase.com](https://supabase.com). **Choose a
   Canadian region** — it matters for the counselling records.
2. SQL Editor → paste `supabase/migrations/0001_init.sql` → Run.
3. SQL Editor → paste `supabase/seed.sql` → Run. Edit the room names and rates
   first if you know the real ones.
4. Project Settings → API → copy the values into `.env.local`
   (start from `.env.example`).
5. Authentication → URL Configuration → add `http://localhost:3000/**` and your
   production URL to the redirect allow-list.
6. Have Tausha sign in once at `/login`, then make her an admin:

```sql
update public.profiles set role = 'admin' where email = 'her-address@example.com';
```

Until someone has that role, `/admin` is locked to everyone.

---

## 4. Stripe

1. Create an account, complete the business details, and connect the bank
   account. Nothing works until Stripe has verified the account.
2. Developers → API keys → copy into `.env.local`. **Use the test keys first.**
3. Developers → Webhooks → Add endpoint:
   - URL: `https://your-site.vercel.app/api/stripe/webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Test locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Card `4242 4242 4242 4242`, any future expiry, any CVC.

**Do a full test run before switching to live keys** — book a room, pay, and
check the booking flips to confirmed and an invoice and payment appear in
`/admin/finance`.

The webhook is the only place a booking is marked paid. The thank-you page is
not proof of payment; anyone can navigate to that URL.

---

## 5. Email (Resend)

1. Create an account at [resend.com](https://resend.com), add and verify the
   domain (DNS records — takes a few minutes to propagate).
2. Copy the API key into `.env.local` and set `EMAIL_FROM` to an address on the
   verified domain.

Before verification, Resend's sandbox sender only delivers to your own address —
so reminders will look like they've failed when they've just been blocked.

---

## 6. Deploy to Vercel

1. Import the GitHub repo at [vercel.com](https://vercel.com).
2. Add every variable from `.env.local` under Settings → Environment Variables.
   Set `NEXT_PUBLIC_SITE_URL` to the real URL.
3. Deploy.

`vercel.json` already schedules the daily reminder job for 15:00 UTC
(≈9am Mountain). Set `CRON_SECRET` to any long random string or the endpoint is
open to anyone who finds it.

---

## 7. Set up Tausha's computer

This is the part that matters most.

1. Install Claude Code (desktop app) on her machine.
2. Clone the repo somewhere obvious — `Documents\Room Within`.
3. Run `npm install` once.
4. Copy your `.env.local` across, or point her at the production Supabase
   project. **Don't give her the Stripe live secret key** — she doesn't need it,
   and the app is built so she never has to touch it.
5. Open Claude Code on that folder. Check that `/preview` starts the site and
   `/publish` pushes.
6. Give her `FOR-TAUSHA.md`.

What makes this work without her touching anything else:

| File | What it does |
| --- | --- |
| `CLAUDE.md` | Tells Claude never to show her code, to preview visually, and to build before publishing |
| `.claude/commands/` | `/preview`, `/publish`, `/undo` |
| `.claude/launch.json` | Lets Claude start the dev server in its own Browser pane |
| `.claude/settings.json` | Pre-approves npm and git so she isn't prompted constantly |

---

## Things worth knowing

**Double-bookings are impossible.** A Postgres exclusion constraint on
`bookings` rejects any overlapping booking for the same room. Two people
clicking confirm at the same instant can't both win — the loser gets "someone
just took that time".

**Counselling data is locked at the database, not the page.**
`counselling_appointments`, `counselling_notes` and `tasks` have an admin-only
policy and no client-facing policy. With RLS on and no matching policy, a
non-admin query returns zero rows. Don't add a policy to "make it work" —
if a query is coming back empty, the caller isn't an admin.

**Money is always integer cents.** Never store dollars as a float.

**The counselling calendar feed puts the secret in the URL.** Google Calendar
can't send an auth header when it polls, so the token is the credential. It's
24 random bytes, the response is no-store and noindex, and revoking means
deleting the row from `calendar_tokens`.

---

## Still to do

Honest list of what isn't built yet:

- **Creating things from the admin UI.** The admin screens read and act on data
  (approve a booking, record a payment, write a note) but adding a tenant, unit,
  event or expense is done by asking Claude, which writes to the database. Worth
  building proper forms once you know which ones she actually reaches for.
- **Generating monthly rent invoices.** The schema, the reminder job and the
  overdue tracking are all there, but something has to create each month's rent
  invoices from the active leases — a monthly cron beside the reminders one.
- **Donations checkout.** The webhook handles `kind: "donation"` and the table
  exists; the donate button on `/support` currently opens an email instead.
- **Automated WhatsApp.** Deliberately not built — see the note in
  `src/components/site/ShareEvent.tsx`.
- **Privacy and booking terms** are placeholders. Get them reviewed.
