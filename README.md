# Room Within Community

The website and management app for Room Within Community — a historic 1905
building on Main Street in Grassy Lake, Alberta, reimagined for families,
learning, entrepreneurship and community.

```bash
npm install && npm run dev
```

It runs with no configuration at all. With no database connected it starts in
**demo mode**: sample rooms, events, tenants and figures throughout, and the
admin area opens without a login. Fill in `.env.local` to make it real.

## Where to look

| If you're… | Read |
| --- | --- |
| Tausha, working on the site | **[FOR-TAUSHA.md](FOR-TAUSHA.md)** |
| Tyler, setting it up | **[SETUP.md](SETUP.md)** |
| Claude, working in this repo | **[CLAUDE.md](CLAUDE.md)** |

## What's in it

**Public site** — landing page, about, spaces and rates, room booking with card
payment, community calendar with `.ics` subscription, counselling information
and enquiry form, and the fundraising page.

**Rentals** — units, leases, invoices, payments, overdue tracking, and reminder
emails that go out on their own.

**Bookings** — requests to approve, confirmed diary, room rates. Overlapping
bookings are rejected by the database, so double-booking is impossible.

**Finance** — income by part of the business, costs by category, twelve months
of income against expenses.

**Counselling** — appointments, session notes, to-do list, and a private
calendar feed. Restricted to the admin account by row-level security in
Postgres, with an append-only access log.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Stripe ·
Resend · deployed on Netlify.

## Layout

```
src/app/(site)      public pages
src/app/(admin)     Tausha's admin area
src/app/api         calendar feeds, Stripe webhook, daily reminders
netlify/functions   the scheduled job that triggers those reminders
src/components      ui/ · brand/ · site/ · admin/ · booking/
src/content         copy Tausha owns — her bio, the six offerings
src/lib             data access, auth, email, pricing, formatting
supabase/           schema migration and seed data
```

Colours and fonts are defined once in `src/app/globals.css`, taken from the
Room Within fundraising poster.
