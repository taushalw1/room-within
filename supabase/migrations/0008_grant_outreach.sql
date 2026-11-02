-- ---------------------------------------------------------------------------
-- What a grant needs before anybody can actually apply for it.
--
-- The grants view already tracks what a grant is, what it's worth and where it
-- sits in the pipeline. What it couldn't answer was the practical question:
-- who do I phone, what share do they actually pay, and where is the form.
--
-- Also adds the two things that turn the page from a list into a tool — a
-- draft email to the funder that can be sent from here, and a record of when
-- a grant went out in the Monday summary so it never goes out twice.
-- ---------------------------------------------------------------------------

alter table public.opportunities
  -- Who to talk to. A phone number on the page is the difference between
  -- "I should ask them" and actually asking them.
  add column if not exists contact_name  text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,

  -- The share of a project a funder will cover. Most capital grants are
  -- matching, and "up to $125,000" means something very different at 50%
  -- than it does at 100%.
  add column if not exists match_percent integer
    check (match_percent is null or match_percent between 0 and 100),
  add column if not exists match_note text,

  -- The application form itself, usually a PDF on the funder's site.
  add column if not exists application_url text,

  -- When the intake opened, so "just opened" can be told from "closing soon".
  add column if not exists opens_on date,

  -- The outreach email: kept as a draft she can edit, then stamped when sent.
  add column if not exists outreach_to      text,
  add column if not exists outreach_subject text,
  add column if not exists outreach_draft   text,
  add column if not exists outreach_sent_at timestamptz,

  -- Stamped when a grant has been included in a Monday summary, so a rerun
  -- of the job never sends the same grant twice.
  add column if not exists digest_sent_at timestamptz;

comment on column public.opportunities.match_percent is
  'Share of the project cost the funder pays. 50 means they pay half and we find the rest.';
comment on column public.opportunities.digest_sent_at is
  'Set when this grant went out in a Monday email. Keeps the digest idempotent.';

create index if not exists opportunities_digest_idx
  on public.opportunities (kind, digest_sent_at)
  where archived_at is null;
