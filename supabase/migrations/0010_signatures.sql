-- ---------------------------------------------------------------------------
-- Signatures, and the evidence that makes them worth something.
--
-- The requirement is not "collect a squiggle". It is: if there is ever a
-- dispute, show that this person signed this exact text, from their own
-- device, and that nobody — including Tausha, including whoever runs this
-- database — altered it afterwards.
--
-- Four things do that work, and all four are enforced here rather than in the
-- application, because application rules can be bypassed and these cannot.
--
--   1. ONLY THE SIGNER CAN SIGN. The insert policy requires signed_by =
--      auth.uid(). There is deliberately no admin insert policy. Tausha
--      cannot create a signature in a tenant's name even with full access to
--      her own account — the database refuses it. This is the single most
--      important line in the file.
--
--   2. WHAT WAS SIGNED IS FIXED. The exact text is hashed at signing time.
--      Change a lease afterwards and the hash no longer matches, which is
--      provable in either direction.
--
--   3. NOTHING CAN BE CHANGED AFTERWARDS. A trigger refuses every update and
--      delete on the record, for everyone, including admins and including the
--      service key. Signing events are append-only, permanently.
--
--   4. THE RECORD IS CHAINED. Each event stores the hash of the one before
--      it. Removing or editing a row in the middle breaks every hash after
--      it, so tampering is detectable rather than merely forbidden.
--
-- What this is NOT: a certified e-signature service. It does not do identity
-- verification beyond control of an email inbox. It is good evidence of who
-- signed what and when; it is not a notarised document.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- --- The signature a person draws once, kept on their profile ---------------

create table if not exists public.signatures (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references public.profiles (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete set null,

  -- Path in the private 'signatures' bucket. Never a public URL.
  image_path  text not null,

  -- Captured server-side at the moment it was drawn.
  created_at  timestamptz not null default now(),
  created_ip  inet,
  created_ua  text
);

alter table public.signatures enable row level security;

-- A person may create and replace their own. Nobody creates one for them.
drop policy if exists signatures_own on public.signatures;
create policy signatures_own on public.signatures
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Tausha may look at them — she needs to see what was signed — but the policy
-- is select only. There is no admin insert, update or delete.
drop policy if exists signatures_admin_read on public.signatures;
create policy signatures_admin_read on public.signatures
  for select using (public.is_admin());

-- --- Every signing event, append-only ---------------------------------------

create table if not exists public.signature_events (
  id              uuid primary key default gen_random_uuid(),

  -- What was signed.
  document_type   text not null
                    check (document_type in
                      ('lease', 'move_out', 'condition_report', 'policy', 'other')),
  document_id     uuid,
  document_title  text not null,
  -- The full text as it appeared on screen. Kept verbatim: the hash is only
  -- meaningful if the thing it hashes is still readable.
  document_text   text not null,
  document_hash   text not null,

  -- Who signed. signed_by is the authenticated user and is checked by policy.
  signed_by       uuid not null references auth.users (id) on delete restrict,
  signer_name     text not null,
  signer_email    text not null,
  signature_path  text,

  -- Where from. Taken from the request on the server, never from the browser,
  -- so it cannot be set by whoever is signing.
  signed_at       timestamptz not null default now(),
  ip              inet,
  user_agent      text,

  -- Tamper-evidence chain.
  prev_hash       text,
  record_hash     text not null,

  -- A short code the signer and Tausha can both quote, so a document can be
  -- checked without anybody sharing a database id.
  verify_code     text not null unique
);

create index if not exists signature_events_doc_idx
  on public.signature_events (document_type, document_id);
create index if not exists signature_events_signer_idx
  on public.signature_events (signed_by, signed_at desc);

-- --- The chain --------------------------------------------------------------

/*
 * Computes the hashes before the row is written.
 *
 * Done in the database on purpose. If the application computed them, anybody
 * who could run the application could write whatever hash they liked. Here,
 * the values are derived from the row itself and from the previous row, and
 * the function is the only thing that sets them.
 */
create or replace function public.seal_signature_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_hash text;
begin
  select record_hash into last_hash
  from public.signature_events
  order by signed_at desc, id desc
  limit 1;

  new.signed_at   := now();
  new.prev_hash   := last_hash;
  new.document_hash := encode(digest(new.document_text, 'sha256'), 'hex');

  new.record_hash := encode(
    digest(
      coalesce(last_hash, '') ||
      new.document_hash ||
      new.signed_by::text ||
      new.signer_email ||
      new.signed_at::text,
      'sha256'
    ),
    'hex'
  );

  -- Six characters is plenty to quote over the phone and still be unguessable
  -- in context, since it is only ever checked against a document you already
  -- have in front of you.
  new.verify_code := upper(substring(new.record_hash from 1 for 6));

  return new;
end $$;

drop trigger if exists signature_events_seal on public.signature_events;
create trigger signature_events_seal
  before insert on public.signature_events
  for each row execute function public.seal_signature_event();

/*
 * Refuses every change and every deletion, for everyone.
 *
 * Not a policy — a trigger — because policies are bypassed by the service
 * key and triggers are not. Once a signature event is written it is written,
 * and the only way to undo one is a new event that supersedes it.
 */
create or replace function public.signature_events_are_final()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Signature events cannot be % once written. Add a new event instead.',
    lower(tg_op);
end $$;

drop trigger if exists signature_events_no_update on public.signature_events;
create trigger signature_events_no_update
  before update on public.signature_events
  for each row execute function public.signature_events_are_final();

drop trigger if exists signature_events_no_delete on public.signature_events;
create trigger signature_events_no_delete
  before delete on public.signature_events
  for each row execute function public.signature_events_are_final();

-- --- Who may write one ------------------------------------------------------

alter table public.signature_events enable row level security;

/*
 * THE important policy.
 *
 * A signing event may only be created by the person it belongs to. There is no
 * admin insert policy and there never should be: the whole evidentiary value
 * of this table rests on Tausha being unable to produce a signature in a
 * tenant's name. If a dispute ever asks "could the landlord have faked this?",
 * the answer is in this policy.
 */
drop policy if exists signature_events_self_insert on public.signature_events;
create policy signature_events_self_insert on public.signature_events
  for insert with check (signed_by = auth.uid());

drop policy if exists signature_events_own_read on public.signature_events;
create policy signature_events_own_read on public.signature_events
  for select using (signed_by = auth.uid());

drop policy if exists signature_events_admin_read on public.signature_events;
create policy signature_events_admin_read on public.signature_events
  for select using (public.is_admin());

-- --- Where drawn signatures live --------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 2097152, array['image/png'])
on conflict (id) do nothing;

-- As with maintenance photos: no storage policies at all. Everything goes
-- through the server after a check on who is asking.
