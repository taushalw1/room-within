# Room Within Community — working notes for Claude

This app is run by **Tausha**, who owns and operates Room Within Community in
Grassy Lake, Alberta, and **Tyler**, who set the project up.

**Tausha is not a developer.** Assume that whoever you are talking to is Tausha
unless it's clear otherwise. How you talk to her matters as much as the code.

---

## Rules when working with Tausha

1. **Never show her code.** No snippets, no diffs, no file contents, no stack
   traces. Describe changes in plain language: "I made the booking buttons
   bigger and moved the price above the button."
2. **Never ask her to copy and paste anything**, or to open a terminal, a
   browser, a code editor, or any window other than Claude. If a task truly
   can't be done from here, say so plainly and tell her to ask Tyler.
3. **Show, don't tell.** After any visual change, start the dev server
   (`preview_start` with the `Room Within` config) and open the page you
   changed in the Browser pane so she can see it. Do this without being asked.
4. **Don't ask permission for small things.** She said "make it warmer" — pick
   a sensible warmer colour from the palette, do it, and show her. Ask only
   when a choice genuinely can't be guessed.
5. **Never ask her for a password, API key, or card number.** If something
   needs a key, tell her which one and say Tyler needs to add it.
6. **One question at a time**, in ordinary words. Not "should I use optimistic
   updates?" but "should the page save straight away, or should there be a Save
   button?"
7. **Confirm before anything destructive** — deleting a page, removing tenant
   or booking records, wiping data. Say exactly what will be lost.

### Publishing

When she says *"publish"*, *"put it live"*, *"make it live"*, or similar:

1. Run `npm run build` to check nothing is broken.
2. If the build fails, fix it, then build again. Do **not** publish a failing
   build, and don't show her the error — just say you're fixing something.
3. `git add -A`, commit with a plain-English message describing what changed,
   and `git push`.
4. Tell her it's live and that it takes a couple of minutes to appear, and give
   her the site link.

If the build can't be fixed in a couple of attempts, say: *"Something's broken
that I can't fix safely — best to ask Tyler to take a look."* Don't push.

### Before you finish any task

Run **`npm run check`**. If it fails, fix it before telling her you're done. A
change that breaks the build will break the live site the next time anyone
publishes.

**Always `npm run check`, never `npm run build`.** Both run the same checks, but
`build` writes into `.next` — the directory the dev server is serving from — so
running it while a preview is open corrupts the running app and the page dies
with `__webpack_modules__[moduleId] is not a function`. `check` builds into a
scratch directory instead. `build` is only for deploying.

If a preview ever does break that way: stop the server, delete `.next`, and
start it again.

---

## Rules when working with Tyler

Normal engineering conversation — code, diffs and trade-offs are all fine.
Tyler handles: environment variables, Supabase and Stripe dashboards, database
migrations, deployment configuration, and anything involving secrets.

---

## The project

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS v4 · Supabase
(Postgres + Auth + Storage) · Stripe · Resend for email · deployed on Netlify.

**Four modules**, plus the public website:

| Area | Route | Who can see it |
| --- | --- | --- |
| Public website | `/`, `/about`, `/spaces`, `/support` | Everyone |
| Room booking | `/book`, `/my-bookings` | Everyone / the booker |
| Community calendar | `/calendar` | Everyone |
| Counselling requests | `/counselling` | Everyone |
| Tenant portal | `/portal` | Signed-in tenants |
| **Rental manager** | `/admin/rentals` | Tausha only |
| **Bookings admin** | `/admin/bookings` | Tausha only |
| **Finance** | `/admin/finance` | Tausha only |
| **Counselling** | `/admin/counselling` | Tausha only |

### Design

The look comes from the Room Within fundraising poster. **Never introduce a
colour or font that isn't already in the theme.**

- Colours are defined once in `src/app/globals.css` under `@theme`. Use the
  Tailwind names: `olive`, `olive-deep`, `sage`, `sage-pale`, `cream`,
  `parchment`, `burgundy`, `berry`, `tan`, `bark`, `ink`, `ink-soft`.
- Three fonts: `font-display` (Cormorant Garamond — headings),
  `font-body` (Lora — body text), `font-script` (Parisienne — the burgundy
  handwriting; use it sparingly, as an accent only).
- `.eyebrow` is the letterspaced small-caps label used throughout the poster.
- `.brush-banner` is the painted olive banner.
- Reusable pieces live in `src/components/ui` and `src/components/brand`.
  Check there before writing anything new.

### Content Tausha can change without a developer

- Tenants, events and expenses → **she adds these herself** using the "Add …"
  panels on `/admin/rentals`, `/admin/events` and `/admin/finance`. If she asks
  you to add one, point her at the panel rather than doing it for her — then she
  doesn't need you next time. Do it for her only if she'd rather.
- Rooms, units and rates → the "Add a room" / "Add a unit" panels and the Edit
  buttons on `/admin/settings`.
- Her bio and photo → `src/content/about.ts`
- The six offerings and the three-year plan → `src/content/offerings.ts`
- Contact details and navigation → `src/lib/site.ts`

If she asks to change wording that lives in a page file, just edit the file.

### Money

Every amount is stored as an **integer number of cents**. Never store dollars
as a float. Format for display with `money()` / `moneyExact()` from
`src/lib/format.ts`.

### Security rules that must not be relaxed

- **Counselling notes are health information** under Alberta's PIPA/HIA.
  `counselling_appointments`, `counselling_notes` and `tasks` are readable by
  admins only, enforced by row-level security in the database. There is
  deliberately no client-facing policy on those tables. Do not add one.
- The service-role Supabase key bypasses row-level security. It may only be
  used in webhooks, cron routes, and admin server actions that have already
  verified the caller is an admin. It must never reach the browser.
- Anything under `/admin` must check `requireAdmin()` server-side. The
  middleware is a convenience, not the security boundary.
- Never commit `.env.local`.

### Database changes

Add a new numbered file in `supabase/migrations/` — never edit an existing
migration that has already been run. Then update the matching types in
`src/lib/data/types.ts`.

The app is built to run **without** Supabase configured: data helpers fall back
to sample content from `src/lib/data/sample.ts`. Keep that working, so a fresh
clone always shows a complete-looking site.
