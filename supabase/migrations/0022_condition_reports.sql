-- ---------------------------------------------------------------------------
-- What state the place was in, at the start and at the end.
--
-- Alberta's Residential Tenancies Act requires an inspection report at move-in
-- and again at move-out, and requires the tenant to be given the chance to be
-- there and to sign it. A landlord who hasn't got one is in a weak position
-- over a deposit deduction no matter how obviously right they are, because the
-- question is never "was the carpet ruined" but "was it ruined before she
-- moved in", and without a move-in report nobody can say.
--
-- The design decision that matters is this: the tenant's assessment is stored
-- in its own columns rather than overwriting Tausha's. A report where both
-- parties agree the hallway carpet was already stained is worth having. A
-- report where they disagreed, and the disagreement was recorded at the time,
-- is worth far more than one that silently kept whichever answer was typed
-- last — and it is the only version that is honest.
--
-- One move-in and one move-out report per tenancy, sharing an item list, so
-- the two can be put side by side. That comparison is the whole point of
-- keeping them.
-- ---------------------------------------------------------------------------

create table if not exists public.condition_reports (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references public.leases (id) on delete cascade,
  unit_id       uuid references public.units (id) on delete set null,
  contact_id    uuid references public.contacts (id) on delete set null,

  kind          text not null check (kind in ('move_in', 'move_out')),

  inspected_on  date,
  /* Whether the tenant was there. The Act cares, and six months later nobody
     remembers. */
  tenant_present boolean,

  status        text not null default 'draft'
                  check (status in ('draft', 'awaiting_tenant', 'agreed', 'disputed')),

  landlord_note text,
  tenant_note   text,

  /* Signed by the tenant from their own device, through the append-only
     record in 0010. This is what makes the report evidence rather than an
     assertion. */
  tenant_signature_event uuid references public.signature_events (id),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  /* One of each per tenancy. A second move-in report is a mistake, not a
     revision. */
  unique (lease_id, kind)
);

create index if not exists condition_reports_lease_idx
  on public.condition_reports (lease_id, kind);
create index if not exists condition_reports_status_idx
  on public.condition_reports (status, inspected_on);

drop trigger if exists condition_reports_touch on public.condition_reports;
create trigger condition_reports_touch
  before update on public.condition_reports
  for each row execute function public.touch_updated_at();

-- --- The items ----------------------------------------------------------------

create table if not exists public.condition_items (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.condition_reports (id) on delete cascade,

  position      integer not null,
  area          text not null,
  item          text not null,

  /* Tausha's assessment. */
  rating        text check (rating in ('good', 'fair', 'poor', 'damaged', 'missing', 'na')),
  note          text,
  photo_path    text,

  /* The tenant's, kept separately and never overwritten by the other. Where
     these two differ, that difference is the record. */
  tenant_rating text check (tenant_rating in ('good', 'fair', 'poor', 'damaged', 'missing', 'na')),
  tenant_note   text,

  created_at    timestamptz not null default now(),

  unique (report_id, position)
);

create index if not exists condition_items_report_idx
  on public.condition_items (report_id, position);

-- --- Row level security -------------------------------------------------------

alter table public.condition_reports enable row level security;
alter table public.condition_items   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['condition_reports', 'condition_items'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- A tenant sees their own reports, both of them, for as long as the tenancy
-- record exists. Being able to look back at the move-in report while the
-- move-out one is being filled in is the single most useful thing the tenant
-- side of this does.
drop policy if exists condition_reports_own_read on public.condition_reports;
create policy condition_reports_own_read on public.condition_reports
  for select using (
    contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

-- They may add their own view while the report is waiting on them, and not
-- after they have agreed it.
drop policy if exists condition_reports_own_update on public.condition_reports;
create policy condition_reports_own_update on public.condition_reports
  for update using (
    status = 'awaiting_tenant'
    and contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

drop policy if exists condition_items_own_read on public.condition_items;
create policy condition_items_own_read on public.condition_items
  for select using (
    report_id in (
      select r.id from public.condition_reports r
      join public.profiles p on p.contact_id = r.contact_id
      where p.id = auth.uid()
    )
  );

drop policy if exists condition_items_own_update on public.condition_items;
create policy condition_items_own_update on public.condition_items
  for update using (
    report_id in (
      select r.id from public.condition_reports r
      join public.profiles p on p.contact_id = r.contact_id
      where p.id = auth.uid() and r.status = 'awaiting_tenant'
    )
  );

-- --- Which columns each side owns ---------------------------------------------

-- As in 0012: a policy decides rows, never columns, and "the application only
-- sends the right fields" is a promise made by code to itself. Anyone holding
-- a session can call the API directly, so the columns that are Tausha's are
-- pinned to their previous values here for anybody who is not an admin.

create or replace function public.condition_items_tenant_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_landlord_side() then
    return new;
  end if;

  -- A tenant records their own view of an item. The item itself, Tausha's
  -- assessment and her photograph are not theirs to move.
  new.report_id  := old.report_id;
  new.position   := old.position;
  new.area       := old.area;
  new.item       := old.item;
  new.rating     := old.rating;
  new.note       := old.note;
  new.photo_path := old.photo_path;
  new.created_at := old.created_at;

  return new;
end $$;

drop trigger if exists condition_items_tenant_columns on public.condition_items;
create trigger condition_items_tenant_columns
  before update on public.condition_items
  for each row execute function public.condition_items_tenant_columns();

create or replace function public.condition_reports_tenant_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_landlord_side() then
    return new;
  end if;

  -- A tenant writes their own overall note. The report itself — whose it is,
  -- when it was done, what Tausha wrote — is not theirs to move.
  new.lease_id       := old.lease_id;
  new.unit_id        := old.unit_id;
  new.contact_id     := old.contact_id;
  new.kind           := old.kind;
  new.inspected_on   := old.inspected_on;
  new.tenant_present := old.tenant_present;
  new.landlord_note  := old.landlord_note;
  new.created_at     := old.created_at;

  -- The one move a tenant may make on the report itself: signing it off.
  --
  -- Allowed only out of 'awaiting_tenant', only into agreed or disputed, only
  -- once, and only carrying a signature that is genuinely theirs. Those four
  -- conditions together are what stop the status being set to 'agreed' by
  -- anybody holding a session and a crafted request — which is exactly what
  -- a disputed deposit would turn on.
  --
  -- Note that 'disputed' is as freely available as 'agreed'. A tenant must
  -- always be able to sign to say they do not accept the report; a system
  -- that only lets them agree is not recording consent, it is manufacturing
  -- it.
  if old.status = 'awaiting_tenant'
     and new.status in ('agreed', 'disputed')
     and old.tenant_signature_event is null
     and new.tenant_signature_event is not null
     and exists (
       select 1
       from public.signature_events e
       where e.id = new.tenant_signature_event
         and e.signed_by = auth.uid()
         and e.document_id = old.id
     )
  then
    null; -- let the change through exactly as asked
  else
    new.status                 := old.status;
    new.tenant_signature_event := old.tenant_signature_event;
  end if;

  return new;
end $$;

drop trigger if exists condition_reports_tenant_columns on public.condition_reports;
create trigger condition_reports_tenant_columns
  before update on public.condition_reports
  for each row execute function public.condition_reports_tenant_columns();
