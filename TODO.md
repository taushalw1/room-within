# Still to do

Not a plan, a parking place. Things Tausha or Tyler has asked for that aren't
built yet, written so whoever picks one up knows what was actually meant.

Done items get deleted rather than ticked — git remembers.

---

## Waiting on Tyler

- **Run migration 0022** — condition reports are live in the code but the
  tables don't exist yet, so the move-in and move-out condition pages will
  fail against the real database. The Claude Code classifier won't run this
  one because it defines `SECURITY DEFINER` functions, so it has to be run by
  hand. See _Running a migration_ at the bottom.
- **ACSS pre-authorised debit** — taking rent straight from a bank account
  instead of a card. Needs Stripe to approve the account for ACSS, which is an
  application with a wait, not a setting. Worth it: card fees on a month of
  rent are real money.
- **Check the mileage rate** — the CRA rate is stored once in the database and
  every trip keeps the rate that applied when it was made. Confirm the current
  figure is right before Tausha logs many trips against it.

## The app on a phone

- **Let people install it** — it already works offline and has icons, but
  nothing invites anyone to add it to their home screen. Needs an install
  prompt that appears at a sensible moment, not on first load.
- **Notifications** — a real push notification when rent lands, a booking comes
  in, or a counselling request arrives. Needs a decision first: who gets what,
  and does Tausha want her phone buzzing in the evening. Web push on iOS only
  works once the app is installed, so this depends on the item above.

## Money

- **Credit card set up** — finish the Stripe side so people can pay rent and
  bookings by card without Tausha chasing anyone. Keys and dashboard are
  Tyler's.

## Events and the calendar

- **Sharing an event should be WhatsApp, and only Tausha** — right now anyone
  can share and the options are generic. She wants one share button, going to
  WhatsApp, visible only to her.
- **Drop "copy message" from events** — it was a stand-in for sharing and it
  isn't wanted.
- **Add one event to your calendar, not the lot** — today the calendar
  subscription is all-or-nothing. People want the single event they're coming
  to, as an `.ics` download, without subscribing to everything.

## Words

- **"Coaching", not "counselling"** — everywhere she and the public can see it:
  the menu, the page titles, the request form, the emails. The database tables
  keep their names, and the health-information rules that go with them don't
  relax just because the wording changes.

## Birthdays

- **Let people put their birthday in** — on their own profile, optional, day
  and month only unless there's a reason to want the year.
- **A note from Tausha on the day** — an email in her voice, not a template
  that reads like one. Probably wants her to approve or tweak it the morning
  it goes, rather than firing unseen.

---

## Running a migration

PowerShell, on Tyler's machine:

```powershell
cd "C:\Users\tyler\Room Within"
npm run migrate supabase/migrations/0022_condition_reports.sql
```

This is a terminal command, not something to paste into Supabase's SQL editor.
If you'd rather use the SQL editor, open the migration file itself and paste
its contents — not this command.
