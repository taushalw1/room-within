-- ============================================================================
-- Room Within Community — initial schema
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- It is safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
--
-- Four modules live in here:
--   1. Rentals    — units, leases, invoices, payments, reminders
--   2. Bookings   — rooms, bookings, community events
--   3. Finance    — expenses, donations, settings
--   4. Counselling— appointments, notes, tasks  (ADMIN ONLY, see RLS below)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============================================================================
-- 1. People
-- ============================================================================

-- Master customer list. Everyone Tausha deals with has exactly one row here,
-- whether they're a tenant, a room booker, a counselling client, or all three.
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text,
  phone        text,
  organisation text,
  -- What this person is to the business. A person can be several at once.
  tags         text[] not null default '{}',
  address      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists contacts_email_idx on public.contacts (lower(email));
create index if not exists contacts_name_idx  on public.contacts (lower(full_name));

-- Links a Supabase auth login to a contact, and carries the access role.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  full_name  text,
  email      text,
  role       text not null default 'member'
             check (role in ('admin', 'tenant', 'member')),
  created_at timestamptz not null default now()
);

-- Every new signup gets a 'member' profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by every RLS policy below. SECURITY DEFINER so that checking the role
-- doesn't itself trip the policies on `profiles`.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_contact_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select contact_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- 2. Rentals
-- ============================================================================

-- A rentable part of the building: office, residential suite, retail bay.
create table if not exists public.units (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null default 'office'
                check (kind in ('office', 'suite', 'retail', 'storage', 'other')),
  floor         text,
  description   text,
  monthly_rate_cents integer not null default 0,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.leases (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid not null references public.units (id) on delete restrict,
  contact_id     uuid not null references public.contacts (id) on delete restrict,
  start_date     date not null,
  end_date       date,
  rent_cents     integer not null,
  deposit_cents  integer not null default 0,
  -- Day of the month rent is due (1–28 keeps every month valid).
  due_day        smallint not null default 1 check (due_day between 1 and 28),
  status         text not null default 'active'
                 check (status in ('pending', 'active', 'ended')),
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists leases_contact_idx on public.leases (contact_id);
create index if not exists leases_unit_idx    on public.leases (unit_id);

-- One row per thing owed: monthly rent, a room booking, a counselling session.
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  -- Human-friendly sequential number, e.g. RW-000042.
  number        text unique,
  contact_id    uuid not null references public.contacts (id) on delete restrict,
  lease_id      uuid references public.leases (id) on delete set null,
  booking_id    uuid,  -- FK added after `bookings` exists
  appointment_id uuid, -- FK added after `counselling_appointments` exists
  kind          text not null default 'other'
                check (kind in ('rent', 'booking', 'counselling', 'deposit', 'other')),
  description   text,
  period_start  date,
  period_end    date,
  issue_date    date not null default current_date,
  due_date      date not null,
  amount_cents  integer not null,
  tax_cents     integer not null default 0,
  status        text not null default 'draft'
                check (status in ('draft', 'sent', 'paid', 'void')),
  stripe_invoice_id        text,
  stripe_payment_intent_id text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists invoices_contact_idx on public.invoices (contact_id);
create index if not exists invoices_status_idx  on public.invoices (status, due_date);

-- Auto-number invoices: RW-000001, RW-000002, ...
create sequence if not exists public.invoice_number_seq;
create or replace function public.set_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.number is null then
    new.number := 'RW-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_set_number on public.invoices;
create trigger invoices_set_number
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid references public.invoices (id) on delete set null,
  contact_id    uuid not null references public.contacts (id) on delete restrict,
  amount_cents  integer not null,
  paid_at       timestamptz not null default now(),
  method        text not null default 'etransfer'
                check (method in ('stripe', 'etransfer', 'cash', 'cheque', 'other')),
  stripe_payment_intent_id text,
  reference     text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_paid_at_idx on public.payments (paid_at);

-- Which reminder emails have gone out, so nobody gets the same one twice.
create table if not exists public.reminder_log (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  kind        text not null
              check (kind in ('upcoming', 'due_today', 'overdue_3', 'overdue_7', 'overdue_14')),
  to_email    text not null,
  sent_at     timestamptz not null default now(),
  unique (invoice_id, kind)
);

-- An invoice is "overdue" if it's been sent, isn't fully paid, and is past due.
--
-- SECURITY_INVOKER IS LOAD-BEARING. Without it a view runs with its owner's
-- permissions — `postgres` here — which bypasses row-level security on
-- `invoices` and `payments` entirely. A signed-in tenant could then read every
-- tenant's invoices through this view, even though the tables themselves are
-- properly locked down. With it, the view runs as the caller and the policies
-- below apply as intended.
create or replace view public.invoice_balances
with (security_invoker = true)
as
select
  i.*,
  coalesce(p.paid_cents, 0)                                  as paid_cents,
  (i.amount_cents + i.tax_cents - coalesce(p.paid_cents, 0))  as balance_cents,
  case
    when i.status = 'void'  then 'void'
    when i.status = 'draft' then 'draft'
    when (i.amount_cents + i.tax_cents - coalesce(p.paid_cents, 0)) <= 0 then 'paid'
    when i.due_date < current_date then 'overdue'
    else 'outstanding'
  end                                                         as state,
  (current_date - i.due_date)                                 as days_overdue
from public.invoices i
left join (
  select invoice_id, sum(amount_cents) as paid_cents
  from public.payments
  where invoice_id is not null
  group by invoice_id
) p on p.invoice_id = i.id;

-- ============================================================================
-- 3. Bookings & community calendar
-- ============================================================================

create table if not exists public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  description         text,
  capacity            integer,
  hourly_rate_cents   integer not null default 0,
  half_day_rate_cents integer,
  full_day_rate_cents integer,
  min_hours           numeric(4,2) not null default 1,
  buffer_minutes      integer not null default 0,
  is_bookable         boolean not null default true,
  requires_approval   boolean not null default true,
  image_url           text,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete restrict,
  contact_id   uuid references public.contacts (id) on delete set null,
  -- Captured on the public form before a contact record exists.
  booker_name  text not null,
  booker_email text not null,
  booker_phone text,
  title        text not null,
  purpose      text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  attendees    integer,
  status       text not null default 'pending'
               check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  total_cents  integer not null default 0,
  is_paid      boolean not null default false,
  stripe_session_id text,
  /* Show this booking on the public community calendar? */
  is_public    boolean not null default false,
  admin_notes  text,
  created_at   timestamptz not null default now(),
  constraint bookings_time_valid check (ends_at > starts_at)
);
create index if not exists bookings_room_time_idx on public.bookings (room_id, starts_at);

-- Hard guarantee: no two live bookings can overlap in the same room.
-- This is enforced by the database, so a double-booking is impossible even if
-- two people hit "confirm" at the same instant.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'));

alter table public.invoices
  drop constraint if exists invoices_booking_id_fkey;
alter table public.invoices
  add constraint invoices_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;

-- Community events — at the building or anywhere else in Grassy Lake.
create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text unique,
  description    text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  all_day        boolean not null default false,
  location       text,
  is_at_building boolean not null default true,
  room_id        uuid references public.rooms (id) on delete set null,
  host_name      text,
  contact_email  text,
  category       text default 'community',
  image_url      text,
  external_url   text,
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint events_time_valid check (ends_at >= starts_at)
);
create index if not exists events_starts_idx on public.events (starts_at)
  where status = 'published';

-- ============================================================================
-- 4. Counselling — ADMIN ONLY
--
-- Everything in this section is readable and writable by admins alone. There
-- is deliberately no "client can see their own notes" policy: clinical notes
-- are Tausha's working record, not a client-facing document.
-- ============================================================================

create table if not exists public.counselling_appointments (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references public.contacts (id) on delete set null,
  client_name  text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  kind         text not null default 'session'
               check (kind in ('intake', 'session', 'follow_up', 'consult', 'other')),
  location     text default 'Room Within',
  rate_cents   integer not null default 0,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  invoice_id   uuid references public.invoices (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint counselling_time_valid check (ends_at > starts_at)
);
create index if not exists counselling_appts_time_idx
  on public.counselling_appointments (starts_at);

alter table public.invoices
  drop constraint if exists invoices_appointment_id_fkey;
alter table public.invoices
  add constraint invoices_appointment_id_fkey
  foreign key (appointment_id)
  references public.counselling_appointments (id) on delete set null;

create table if not exists public.counselling_notes (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.counselling_appointments (id) on delete cascade,
  contact_id     uuid references public.contacts (id) on delete set null,
  body           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Every read of a clinical note is recorded. Append-only: nobody, including
-- an admin, can update or delete rows here (no policy grants it).
create table if not exists public.counselling_access_log (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid,
  actor_id   uuid,
  action     text not null,
  at         timestamptz not null default now()
);

-- Requests submitted from the public "Request counselling" form.
create table if not exists public.counselling_requests (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text not null,
  phone           text,
  message         text,
  preferred_times text,
  status          text not null default 'new'
                  check (status in ('new', 'contacted', 'scheduled', 'declined', 'closed')),
  created_at      timestamptz not null default now()
);

-- Tausha's private to-do list.
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  notes      text,
  due_date   date,
  status     text not null default 'open'
             check (status in ('open', 'doing', 'done')),
  area       text default 'general'
             check (area in ('general', 'rentals', 'bookings', 'finance', 'counselling')),
  contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Secret tokens behind the .ics calendar subscription URLs.
create table if not exists public.calendar_tokens (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('counselling', 'admin')),
  token      text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. Finance
-- ============================================================================

create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  incurred_on    date not null default current_date,
  vendor         text,
  category       text not null default 'other',
  description    text,
  amount_cents   integer not null,
  tax_cents      integer not null default 0,
  payment_method text,
  receipt_url    text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (incurred_on);

create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  donor_name   text,
  email        text,
  amount_cents integer not null,
  is_anonymous boolean not null default false,
  message      text,
  stripe_session_id text,
  received_at  timestamptz not null default now()
);

-- Free-form config: tax rate, reminder timing, counselling hourly rate, etc.
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('rates',     '{"counselling_hourly_cents": 14000, "gst_rate": 0.05}'),
  ('reminders', '{"upcoming_days_before": 3, "overdue_days": [3, 7, 14]}'),
  ('business',  '{"name": "Room Within Community", "town": "Grassy Lake, Alberta"}')
on conflict (key) do nothing;

-- ============================================================================
-- 6. Row Level Security
-- ============================================================================

alter table public.contacts                 enable row level security;
alter table public.profiles                 enable row level security;
alter table public.units                    enable row level security;
alter table public.leases                   enable row level security;
alter table public.invoices                 enable row level security;
alter table public.payments                 enable row level security;
alter table public.reminder_log             enable row level security;
alter table public.rooms                    enable row level security;
alter table public.bookings                 enable row level security;
alter table public.events                   enable row level security;
alter table public.counselling_appointments enable row level security;
alter table public.counselling_notes        enable row level security;
alter table public.counselling_access_log   enable row level security;
alter table public.counselling_requests     enable row level security;
alter table public.tasks                    enable row level security;
alter table public.calendar_tokens          enable row level security;
alter table public.expenses                 enable row level security;
alter table public.donations                enable row level security;
alter table public.settings                 enable row level security;

-- Admin can do everything, on everything.
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','profiles','units','leases','invoices','payments','reminder_log',
    'rooms','bookings','events','counselling_appointments','counselling_notes',
    'counselling_requests','tasks','calendar_tokens','expenses','donations','settings'
  ] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- --- Public read -------------------------------------------------------------

drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read on public.rooms
  for select using (is_bookable = true);

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (status = 'published');

-- Anyone may ask for a room or for counselling; only admins can read those
-- submissions back.
drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert on public.bookings
  for insert with check (status = 'pending' and is_paid = false);

drop policy if exists counselling_requests_public_insert on public.counselling_requests;
create policy counselling_requests_public_insert on public.counselling_requests
  for insert with check (true);

-- --- Signed-in users ---------------------------------------------------------

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists contacts_read_own on public.contacts;
create policy contacts_read_own on public.contacts
  for select using (id = public.my_contact_id());

drop policy if exists invoices_read_own on public.invoices;
create policy invoices_read_own on public.invoices
  for select using (contact_id = public.my_contact_id());

drop policy if exists payments_read_own on public.payments;
create policy payments_read_own on public.payments
  for select using (contact_id = public.my_contact_id());

drop policy if exists leases_read_own on public.leases;
create policy leases_read_own on public.leases
  for select using (contact_id = public.my_contact_id());

drop policy if exists bookings_read_own on public.bookings;
create policy bookings_read_own on public.bookings
  for select using (
    contact_id = public.my_contact_id()
    or lower(booker_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- NOTE: counselling_appointments, counselling_notes, counselling_access_log
-- and tasks intentionally have NO non-admin policy. With RLS enabled and no
-- matching policy, every non-admin read returns zero rows.

-- The public calendar needs to know when rooms are busy, without leaking who
-- booked them or what for. This function returns times only.
create or replace function public.room_busy_times(
  p_room_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.room_id = p_room_id
    and b.status in ('pending', 'confirmed')
    and b.starts_at < p_to
    and b.ends_at   > p_from
  union all
  select e.starts_at, e.ends_at
  from public.events e
  where e.room_id = p_room_id
    and e.status = 'published'
    and e.starts_at < p_to
    and e.ends_at   > p_from;
$$;

grant execute on function public.room_busy_times(uuid, timestamptz, timestamptz)
  to anon, authenticated;
