# Supabase email templates

Supabase sends the sign-in emails, not the app, so its templates live here
rather than in `src/lib/email/`. They're kept in the repo so they're version
controlled and can be re-pasted if anyone changes them by accident.

## Installing one

The Supabase dashboard has no import — it's copy and paste.

1. Open the `.html` file **in Notepad**, not the browser. A browser renders it;
   you need the source.
   ```powershell
   notepad "C:\Users\tyler\Room Within\supabase\email-templates\magic-link.html"
   ```
2. **Ctrl+A**, **Ctrl+C**
3. Supabase → **Authentication → Email Templates** → pick the template
4. Choose **Source** (not Preview), select everything in the Body box, paste
5. **Save**, then click **Preview** to check it

## Which template fires when

Supabase picks by whether it has seen the address before, so **both need
doing** — styling only one leaves half your visitors with an unbranded email,
and a link that doesn't work.

| Template | Sent to |
| --- | --- |
| `confirm-signup.html` → **Confirm signup** | someone signing in for the first time |
| `magic-link.html` → **Magic Link** | everyone after that |

Note the `type` differs in the two links — `signup` and `email`. The callback
passes it through to Supabase's verification, so it has to match the template
it came from.

## magic-link.html

Used for every sign-in, since the app is passwordless. Set the subject to:

    Your sign-in link — Room Within Community

Two things about it matter:

**It uses `{{ .TokenHash }}`, not `{{ .ConfirmationURL }}`.** The default
carries a browser-specific credential, so a link requested on a laptop and
opened on a phone fails. TokenHash is verified server-side and works wherever
it's opened, which is how people actually read email.

**It builds the link from `{{ .SiteURL }}`**, which comes from Authentication →
URL Configuration. That must read `https://roomwithin.ca` or every sign-in
email points somewhere dead.

## confirm-signup.html

The first email a new person ever gets from Room Within. Set the subject to:

    Welcome to Room Within Community

The default wording — "confirm this email address and finish signing up" —
describes a signup flow that doesn't exist here. There's no password and no
second step: confirming *is* signing in, and this says so.

## Keeping the look consistent

The markup mirrors `shell()` in `src/lib/email/send.ts` — same cream and olive,
same logo, same 600px table layout. If you restyle one, restyle both, or the
sign-in email will drift away from everything else people receive.
