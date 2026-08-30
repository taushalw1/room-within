-- ============================================================================
-- Track who has been sent the welcome email.
--
-- Sign-in is passwordless, so there is no separate "sign up" moment to hang a
-- welcome message on — the account is created the first time someone follows
-- an emailed link. This column is what makes "first time" answerable, so the
-- welcome goes out once rather than on every sign-in.
--
-- Run this in the Supabase SQL editor, then update src/lib/data/types.ts.
-- ============================================================================

alter table public.profiles
  add column if not exists welcomed_at timestamptz;

comment on column public.profiles.welcomed_at is
  'When the welcome email was sent. Null means it has not been sent yet.';
