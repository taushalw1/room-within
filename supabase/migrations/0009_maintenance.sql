-- ---------------------------------------------------------------------------
-- Maintenance: what renters report, and what it costs to put right.
--
-- A renter opens their page, says the tap is leaking, takes a photo. It lands
-- on Tausha's list. She fixes it, ticks it off, records what it cost and keeps
-- the receipt. The renter is told. Either side can mark it done, because the
-- plumber often tells the renter before he tells the landlord.
--
-- Photos and receipts live in a private Storage bucket. There are deliberately
-- no public policies on it: every read goes through a server route that checks
-- who is asking first, so a leaked path is worth nothing on its own.
-- ---------------------------------------------------------------------------

create table if not exists public.maintenance_requests (
  id            uuid primary key default gen_random_uuid(),

  unit_id       uuid references public.units (id) on delete set null,
  lease_id      uuid references public.leases (id) on delete set null,
  contact_id    uuid references public.contacts (id) on delete set null,

  -- Kept alongside the contact link so a report still says who made it even
  -- if the person is later removed from the contact list.
  reported_by   text not null,

  title         text not null,
  detail        text,

  urgency       text not null default 'normal'
                  check (urgency in ('whenever', 'normal', 'urgent')),

  -- Path inside the private 'maintenance' bucket. Never a public URL.
  photo_path    text,

  status        text not null default 'new'
                  check (status in ('new', 'seen', 'doing', 'fixed', 'declined')),

  -- Who said it was fixed. The renter is often the first to know.
  fixed_at      timestamptz,
  fixed_by      text check (fixed_by in ('renter', 'tausha')),

  -- Filled in after the fact, when she has the invoice in her hand.
  cost_cents    integer check (cost_cents is null or cost_cents >= 0),
  receipt_path  text,
  cost_note     text,
  -- The expense row this became, so the money shows up in the books once.
  expense_id    uuid references public.expenses (id) on delete set null,

  admin_notes   text,
  -- Her reply, shown to the renter. Separate from admin_notes, which is not.
  reply_to_renter text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists maintenance_status_idx
  on public.maintenance_requests (status, created_at desc);
create index if not exists maintenance_contact_idx
  on public.maintenance_requests (contact_id, created_at desc);
create index if not exists maintenance_unit_idx
  on public.maintenance_requests (unit_id, created_at desc);

-- Keep updated_at honest without the app having to remember.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists maintenance_touch on public.maintenance_requests;
create trigger maintenance_touch
  before update on public.maintenance_requests
  for each row execute function public.touch_updated_at();

-- --- Row level security -------------------------------------------------------

alter table public.maintenance_requests enable row level security;

drop policy if exists admin_all on public.maintenance_requests;
create policy admin_all on public.maintenance_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- A renter sees their own reports, and only their own.
drop policy if exists maintenance_own_read on public.maintenance_requests;
create policy maintenance_own_read on public.maintenance_requests
  for select using (
    contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

drop policy if exists maintenance_own_insert on public.maintenance_requests;
create policy maintenance_own_insert on public.maintenance_requests
  for insert with check (
    contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

-- They may change or withdraw a report until it has been dealt with. After
-- that it is part of the building's record and stops being theirs to edit.
drop policy if exists maintenance_own_update on public.maintenance_requests;
create policy maintenance_own_update on public.maintenance_requests
  for update using (
    status <> 'declined'
    and contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

drop policy if exists maintenance_own_delete on public.maintenance_requests;
create policy maintenance_own_delete on public.maintenance_requests
  for delete using (
    status in ('new', 'seen')
    and contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

-- --- Where the photos go ------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance',
  'maintenance',
  false,
  10485760,                       -- 10 MB; a phone photo is well under this
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- No policies are added for this bucket on purpose. Nothing reaches it with an
-- anon or user key. The app reads and writes it server-side with the service
-- key, after checking who is asking — so a path that leaks is useless by
-- itself, and a renter can never read another renter's photo.
