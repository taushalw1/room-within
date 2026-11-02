-- ---------------------------------------------------------------------------
-- Ending a tenancy: the clean-out checklist, and what happens to the deposit.
--
-- The deposit is the part with legal consequences. Alberta requires a landlord
-- to account for deductions and return the balance within a set time, and
-- "we talked about it" is not an account. So every movement is a row: what was
-- held, what was taken and why, what went back and when. The balance is
-- derived from those rows rather than typed, so it can't drift.
--
-- The checklist is signed by the tenant from their own device, through the
-- append-only signature record in migration 0010. That is what makes an agreed
-- deduction provable later.
-- ---------------------------------------------------------------------------

create table if not exists public.move_outs (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references public.leases (id) on delete cascade,
  unit_id       uuid references public.units (id) on delete set null,
  contact_id    uuid references public.contacts (id) on delete set null,

  -- The day they are actually out, which is often not the lease end date.
  leaving_on    date not null,
  forwarding_address text,
  forwarding_email   text,

  status        text not null default 'open'
                  check (status in ('open', 'tenant_done', 'inspected', 'settled')),

  -- Filled in at the walk-through.
  inspected_on  date,
  inspection_notes text,

  -- Signed by the tenant, from their device. Points at the sealed event.
  tenant_signature_event uuid references public.signature_events (id),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists move_outs_lease_idx on public.move_outs (lease_id);
create index if not exists move_outs_status_idx on public.move_outs (status, leaving_on);

drop trigger if exists move_outs_touch on public.move_outs;
create trigger move_outs_touch
  before update on public.move_outs
  for each row execute function public.touch_updated_at();

-- --- The checklist itself -----------------------------------------------------

create table if not exists public.move_out_items (
  id            uuid primary key default gen_random_uuid(),
  move_out_id   uuid not null references public.move_outs (id) on delete cascade,

  position      integer not null,
  area          text not null,
  title         text not null,
  detail        text,

  -- Ticked by the tenant as they work through it.
  done_by_tenant boolean not null default false,
  tenant_note   text,

  -- Confirmed, or not, by Tausha at the walk-through.
  checked_by_admin boolean,
  admin_note    text,
  -- A deduction proposed against this line, in cents.
  charge_cents  integer check (charge_cents is null or charge_cents >= 0),
  photo_path    text,

  created_at    timestamptz not null default now(),

  unique (move_out_id, position)
);

create index if not exists move_out_items_parent_idx
  on public.move_out_items (move_out_id, position);

-- --- The deposit, as a ledger -------------------------------------------------

-- Every movement, never a running total. The balance is the sum of the rows,
-- so there is no figure that can quietly stop matching its own history.
create table if not exists public.deposit_entries (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references public.leases (id) on delete cascade,
  move_out_id   uuid references public.move_outs (id) on delete set null,

  -- Positive is money in (the deposit, interest). Negative is money out
  -- (a deduction, or the return at the end).
  amount_cents  integer not null,
  kind          text not null
                  check (kind in ('held', 'interest', 'deduction', 'returned')),
  reason        text not null,
  occurred_on   date not null default current_date,

  -- The receipt or photo backing a deduction, if there is one.
  evidence_path text,

  created_at    timestamptz not null default now()
);

create index if not exists deposit_entries_lease_idx
  on public.deposit_entries (lease_id, occurred_on);

-- --- Row level security -------------------------------------------------------

alter table public.move_outs       enable row level security;
alter table public.move_out_items  enable row level security;
alter table public.deposit_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['move_outs', 'move_out_items', 'deposit_entries'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- A tenant sees their own move-out and ticks their own boxes. They never see
-- or touch another tenancy's.
drop policy if exists move_outs_own_read on public.move_outs;
create policy move_outs_own_read on public.move_outs
  for select using (
    contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

drop policy if exists move_outs_own_update on public.move_outs;
create policy move_outs_own_update on public.move_outs
  for update using (
    status in ('open', 'tenant_done')
    and contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

drop policy if exists move_out_items_own_read on public.move_out_items;
create policy move_out_items_own_read on public.move_out_items
  for select using (
    move_out_id in (
      select m.id from public.move_outs m
      join public.profiles p on p.contact_id = m.contact_id
      where p.id = auth.uid()
    )
  );

-- They may tick their own boxes, but nothing else on the row — the charge and
-- the admin's verdict are not theirs to set. Column-level control isn't
-- available in a policy, so the application only ever sends those two fields
-- and the admin columns start null.
drop policy if exists move_out_items_own_tick on public.move_out_items;
create policy move_out_items_own_tick on public.move_out_items
  for update using (
    move_out_id in (
      select m.id from public.move_outs m
      join public.profiles p on p.contact_id = m.contact_id
      where p.id = auth.uid() and m.status in ('open', 'tenant_done')
    )
  );

-- The deposit record is readable by the tenant it belongs to, and writable by
-- nobody but Tausha.
drop policy if exists deposit_own_read on public.deposit_entries;
create policy deposit_own_read on public.deposit_entries
  for select using (
    lease_id in (
      select l.id from public.leases l
      join public.profiles p on p.contact_id = l.contact_id
      where p.id = auth.uid()
    )
  );
