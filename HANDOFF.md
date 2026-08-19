# Setting up Tausha's computer

For Tyler. Work through this **on her machine**, signed in as her.

The goal: when you leave, she can change the website by typing into Claude and
nothing else. No terminal, no GitHub, no Supabase, no Netlify.

Budget about 40 minutes, most of it downloads.

---

## Before you start, on your own machine

Get her `.env.local` onto a USB stick, or somewhere you can reach from her
computer. It holds the database keys and is deliberately not in GitHub, so
cloning the repo does **not** bring it along. Without it her copy runs on
sample data and nothing she does is real.

Don't email it — it contains the service-role key.

**The repository is public**, so it is doubly important that this file never
goes into the project folder's git history. It's already in `.gitignore`;
leave it that way.

---

## 1. Install three things

| What | Where | Notes |
| --- | --- | --- |
| **Claude Code** (desktop app) | claude.ai/download | Sign her in with her own Claude account |
| **Node.js LTS** | nodejs.org | Take the default options |
| **Git** | git-scm.com | Take the default options |

Restart the machine afterwards so the PATH settles. Then check both work:

```powershell
node --version; git --version
```

---

## 2. Clone the repo

Somewhere obvious and shallow. Avoid OneDrive-synced folders — the sync
fights with `node_modules` and causes odd file-locking errors.

```powershell
cd "C:\Users\<her-username>\Documents"
git clone https://github.com/taushalw1/room-within.git "Room Within"
```

It will ask her to sign in to GitHub. **Let her do it with her own account** —
she owns the repo. A browser window opens; she approves; Windows stores the
credential permanently.

**This step is what makes `/publish` work.** If the credential isn't stored,
every publish will fail with an authentication prompt she can't answer.

---

## 3. Install the app's dependencies

```powershell
cd "C:\Users\<her-username>\Documents\Room Within"; npm install
```

Takes a few minutes.

---

## 4. Copy the keys across

Put `.env.local` into the project folder — the same folder as `package.json`.
Then confirm it landed correctly:

```powershell
cd "C:\Users\<her-username>\Documents\Room Within"; npm run check:db
```

Every line should say PASS. It masks the keys, so it's safe to run in front of
her.

**Note:** her computer talks to the same database as the live website. That's
deliberate — what she sees while editing is the real thing. It also means
if she deletes a tenant on her machine, it's deleted for real. The app asks
before anything destructive.

---

## 5. Set the shared commit identity

**Both machines commit as the same identity.** This is not cosmetic — Netlify's
free plan allows exactly one Git contributor on a private repo, and a second
name in the history fails every build after it with "unrecognized Git
contributor".

```powershell
cd "C:\Users\<her-username>\Documents\Room Within"; git config user.name "Room Within"; git config user.email "318375335+taushalw1@users.noreply.github.com"
```

That address is GitHub's built-in one for Tausha's account — the number is
her account ID. It looks strange but it's permanently tied to her login,
needs no mailbox, and can't stop working if an email password changes.

Don't set it to her own name, however natural that feels. The trade is that
the history won't record which of you made a given change — acceptable for two
people, and the alternative is $19 a month or a public repo.

---

## 6. Make her an admin

She can't reach `/admin` until her account has the admin role.

1. Have her sign in once at the live site: `https://roomwithin.netlify.app/login`
2. She gets an email with a link; clicking it creates her account
3. On **your** machine, in Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'her-address@example.com';
```

4. Confirm it took:

```sql
select email, role from public.profiles;
```

---

## 7. Prove the whole loop works — with her watching

This is the important part. Don't just check it yourself; have her do it, so
she's seen it work once.

1. Open Claude Code on the project folder
2. She types **`/preview`** → the website should open beside the chat
3. She asks for something small and visible, in her own words —
   *"make the heading on the front page bigger"*
4. She types **`/publish`**
5. Wait two minutes, then load `https://roomwithin.netlify.app` on her phone
   and show her the change is really there

If all five work, she's set up. If `/publish` fails, it's almost always the
GitHub credential from step 2.

---

## 8. Leave her with this

Open **`FOR-TAUSHA.md`** in the project and read it through with her. It's one
page. The three commands she needs:

| She types | What happens |
| --- | --- |
| `/preview` | The website opens so she can look at it |
| `/publish` | Checks it works, then puts it live |
| `/undo` | Puts things back |

Everything else is just asking in plain English.

Tell her the two things that are genuinely true and reassuring:

- **Nothing she does is live until she types `/publish`.** She can experiment.
- **Claude won't publish a broken website.** It checks the build first and
  refuses if something's wrong.

---

## What she will never need to open

Supabase, GitHub, Netlify, PowerShell, a code editor. If Claude ever tells her
to open one of those, that's a bug in the instructions — she should ask you.

The pieces that make that true, all committed in the repo:

| File | What it does |
| --- | --- |
| `CLAUDE.md` | Tells Claude never to show her code, to preview visually, to run `npm run check` before finishing, and to build-then-push on "publish" |
| `.claude/commands/` | `/preview`, `/publish`, `/undo` |
| `.claude/launch.json` | Lets Claude start the dev server in its own browser pane, on port 4300 |
| `.claude/settings.json` | Pre-approves npm, git and the browser tools so she isn't asked to approve anything |

`settings.json` uses project-relative paths, so it works regardless of where
the folder lives on her machine.

---

## Things to tell her to ask you for

Claude will refuse these deliberately, and she should expect that:

- Anything with a password, key, or bank detail
- Stripe setup or changes
- Giving someone else admin access
- The domain name or the hosting bill

---

## If something goes wrong later

**"Publish isn't working."** Usually the GitHub credential expired. Redo the
sign-in from step 2.

**Netlify says "unrecognized Git contributor".** A commit was made under a
different name. Every commit must show "Room Within" as the author. Fix the
identity as in step 5; anything already committed under the wrong name has to
be re-authored and force-pushed.

**"The preview page is broken"** — a white screen or `__webpack_modules__`
error. Ask Claude to *"stop the preview, delete the .next folder, and start it
again."* It knows how; it's in `CLAUDE.md`.

**She pulls a change you made and it errors.** Ask Claude to *"install the
latest packages"* — it runs `npm install` without asking.

---

## Still not built

So you're not surprised when she asks:

- **Monthly rent invoices aren't generated automatically.** The reminders,
  overdue tracking and emails all work, but something has to create each
  month's invoices from the active leases. Nothing does that yet.
- **Stripe isn't connected**, so nobody can pay by card yet. Bookings are
  requested and invoiced; payment is recorded by hand.
- **Email isn't connected** (Resend), so reminder emails won't actually send.
- **Donations** on the Support page open an email rather than taking payment.
- **Privacy and booking terms** are placeholder text. Get them reviewed before
  the site is promoted widely.
