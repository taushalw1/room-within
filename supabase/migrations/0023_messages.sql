-- ---------------------------------------------------------------------------
-- Saved messages, and a record of what was actually sent.
--
-- The templates are the smaller half. The log is the half that earns its
-- keep: "have I already chased them about this?" is a question asked weekly
-- and currently answered by searching a personal mailbox, which is both slow
-- and the wrong place for a record about a tenancy to live.
--
-- What was sent is stored as it was sent — the filled-in text, not the
-- template and a set of values. A template will be edited, and a log that
-- re-derived its own history from the current wording would quietly start
-- misreporting what somebody was actually told.
-- ---------------------------------------------------------------------------

create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),

  name        text not null,
  subject     text not null,
  body        text not null,

  /* Soft-deleted rather than removed, so the log can still name the template
     a message came from years later. */
  is_active   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists message_templates_active_idx
  on public.message_templates (is_active, name);

drop trigger if exists message_templates_touch on public.message_templates;
create trigger message_templates_touch
  before update on public.message_templates
  for each row execute function public.touch_updated_at();

create table if not exists public.messages_sent (
  id            uuid primary key default gen_random_uuid(),

  contact_id    uuid references public.contacts (id) on delete set null,
  /* Kept even if the contact is removed, because the log is a record of what
     was done and to whom. */
  to_email      text not null,
  to_name       text,

  template_id   uuid references public.message_templates (id) on delete set null,
  /* The wording as it actually went out. See the note above. */
  subject       text not null,
  body          text not null,

  /* Whether Resend accepted it. A message that failed to send is still worth
     a row — otherwise the only trace of a failed chase is its absence, which
     looks identical to never having tried. */
  delivered     boolean not null default false,
  failure       text,

  sent_by       uuid references public.profiles (id) on delete set null,
  sent_at       timestamptz not null default now()
);

create index if not exists messages_sent_contact_idx
  on public.messages_sent (contact_id, sent_at desc);
create index if not exists messages_sent_recent_idx
  on public.messages_sent (sent_at desc);

-- --- Row level security -------------------------------------------------------

alter table public.message_templates enable row level security;
alter table public.messages_sent     enable row level security;

-- Admin only on both, and deliberately no tenant-facing read on the log: it
-- contains what was written to every other tenant.
do $$
declare t text;
begin
  foreach t in array array['message_templates', 'messages_sent'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
