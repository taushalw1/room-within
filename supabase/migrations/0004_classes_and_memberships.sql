-- ---------------------------------------------------------------------------
-- Classes, instructors, equipment, storage, and community memberships.
--
-- The shape here follows the operating model Tausha worked out:
--
--   * One rate card, no per-instructor negotiation. The revenue split is set
--     by the hub, not agreed case by case.
--   * Three fixed price tiers — full, reduced, subsidized — that an attendee
--     picks for themselves, so nobody has to ask for a discount out loud.
--   * Materials are the instructor's own cost and their own money. They are
--     recorded for the landlord's records only and never shown to attendees.
--   * Equipment hire and storage are the hub's income, deducted from the
--     instructor's payout rather than invoiced separately.
--   * Memberships buy credits. Credits are a promise of a class not yet
--     taught, so they are tracked as a liability, not as income.
--
-- Money is in integer cents throughout, as everywhere else in this schema.
-- ---------------------------------------------------------------------------

-- --- Instructors -------------------------------------------------------------

create table if not exists public.instructors (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid references public.contacts (id) on delete set null,
  display_name      text not null,
  headline          text,
  bio               text,
  photo_url         text,

  -- Standing is arithmetic, not opinion: earned_at is stamped by the app when
  -- the thresholds in settings are met, so there is no committee and no
  -- accusation of favouritism.
  standing          text not null default 'new'
                      check (standing in ('new', 'earned')),
  earned_at         timestamptz,

  -- Off by default. Turning it on means the hub pays for a scheduled class
  -- even when nobody comes — a real cash-flow commitment, so it is a
  -- deliberate per-instructor decision rather than a consequence of standing.
  guaranteed_pay_cents integer not null default 0
                      check (guaranteed_pay_cents >= 0),

  -- Overrides the hub-wide split only where there is a written reason to.
  split_percent     integer check (split_percent between 0 and 100),

  agreement_signed_on date,
  waiver_signed_on    date,
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists instructors_active_idx
  on public.instructors (is_active, display_name);

-- --- Equipment the hub owns and hires out -------------------------------------

create table if not exists public.equipment (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  quantity          integer not null default 1 check (quantity > 0),
  session_rate_cents integer not null default 0 check (session_rate_cents >= 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- --- Storage let to instructors, billed by the month --------------------------

create table if not exists public.storage_rentals (
  id                uuid primary key default gen_random_uuid(),
  instructor_id     uuid not null references public.instructors (id) on delete cascade,
  label             text not null,                 -- "Shelf 3", "Corner of the maker space"
  size              text not null default 'shelf'
                      check (size in ('shelf', 'locker', 'closet', 'corner', 'room')),
  monthly_rate_cents integer not null check (monthly_rate_cents >= 0),
  started_on        date not null default current_date,
  ended_on          date,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists storage_rentals_instructor_idx
  on public.storage_rentals (instructor_id, ended_on);

-- --- Classes ------------------------------------------------------------------

create table if not exists public.classes (
  id                uuid primary key default gen_random_uuid(),
  instructor_id     uuid references public.instructors (id) on delete set null,
  room_id           uuid references public.rooms (id) on delete set null,

  title             text not null,
  summary           text,
  description       text,

  session_minutes   integer not null default 90 check (session_minutes > 0),
  capacity          integer not null default 10 check (capacity > 0),

  -- The three tiers an attendee chooses between. Everything else about the
  -- money follows from which one they picked.
  full_price_cents       integer not null check (full_price_cents >= 0),
  reduced_price_cents    integer not null check (reduced_price_cents >= 0),
  subsidized_price_cents integer not null check (subsidized_price_cents >= 0),

  -- How many subsidised seats the scholarship fund will carry per session.
  subsidized_seat_cap integer not null default 3 check (subsidized_seat_cap >= 0),

  -- What a member spends to attend. Standard class = 1, specialty = 2.
  credit_cost       integer not null default 1 check (credit_cost >= 0),

  -- The instructor's own cost, for the landlord's records only. This is never
  -- exposed to an attendee and never enters the split.
  materials_cost_cents integer not null default 0 check (materials_cost_cents >= 0),
  materials_note    text,

  -- Below this many people a session cancels itself and credits go back.
  min_headcount     integer not null default 3 check (min_headcount >= 0),

  status            text not null default 'draft'
                      check (status in ('draft', 'open', 'full', 'finished', 'cancelled')),
  is_public         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists classes_status_idx on public.classes (status, is_public);

-- Equipment a class uses. Charged per session that actually runs.
create table if not exists public.class_equipment (
  class_id     uuid not null references public.classes (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  quantity     integer not null default 1 check (quantity > 0),
  primary key (class_id, equipment_id)
);

-- --- Sessions -----------------------------------------------------------------

create table if not exists public.class_sessions (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,

  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'confirmed', 'cancelled', 'delivered')),

  -- Stamped by the confirm/cancel job so the decision is auditable.
  decided_at    timestamptz,
  cancel_reason text,

  attendance_recorded_at timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),

  check (ends_at > starts_at)
);

create index if not exists class_sessions_when_idx
  on public.class_sessions (starts_at);
create index if not exists class_sessions_class_idx
  on public.class_sessions (class_id, starts_at);

-- --- Enrolments ---------------------------------------------------------------

create table if not exists public.enrolments (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.class_sessions (id) on delete cascade,
  contact_id    uuid references public.contacts (id) on delete set null,

  attendee_name  text not null,
  attendee_email text,

  tier          text not null default 'full'
                  check (tier in ('full', 'reduced', 'subsidized')),

  -- How they paid: cash/card, or by spending membership credits.
  method        text not null default 'cash'
                  check (method in ('cash', 'credit')),
  credits_spent integer not null default 0 check (credits_spent >= 0),
  paid_cents    integer not null default 0 check (paid_cents >= 0),

  -- What the scholarship fund made up between the tier price and full price.
  subsidy_cents integer not null default 0 check (subsidy_cents >= 0),

  attended      boolean,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),

  unique (session_id, contact_id)
);

create index if not exists enrolments_session_idx
  on public.enrolments (session_id, cancelled_at);

-- --- Memberships and credits --------------------------------------------------

create table if not exists public.memberships (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts (id) on delete cascade,

  plan            text not null default 'individual'
                    check (plan in ('individual', 'family')),

  -- A family plan is one shared pool, deliberately: one account, one balance,
  -- and the household sorts out priorities between themselves.
  household_name  text,

  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  credits_per_month   integer not null check (credits_per_month >= 0),

  status          text not null default 'active'
                    check (status in ('active', 'paused', 'cancelled')),
  started_on      date not null default current_date,
  cancelled_on    date,

  stripe_subscription_id text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists memberships_contact_idx
  on public.memberships (contact_id, status);

-- Every credit in and out, so a balance is never a number somebody typed.
create table if not exists public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,

  delta         integer not null,           -- positive granted, negative spent
  reason        text not null
                  check (reason in ('monthly', 'purchase', 'spent', 'refund', 'expired', 'adjustment')),

  session_id    uuid references public.class_sessions (id) on delete set null,

  -- Credits granted carry an expiry; credits spent do not.
  expires_on    date,
  period        date,                        -- the month a 'monthly' grant is for
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists credit_ledger_membership_idx
  on public.credit_ledger (membership_id, created_at);

-- One monthly grant per membership per period, so a job that runs twice — or
-- a nervous second click — cannot hand out credits twice.
create unique index if not exists credit_ledger_one_grant_per_period
  on public.credit_ledger (membership_id, period)
  where reason = 'monthly' and period is not null;

-- --- Instructor statements ----------------------------------------------------

-- A statement is a month, closed off and kept. The figures are recomputed from
-- the sessions until it is marked paid, and frozen afterwards so a statement
-- somebody has already been paid against cannot silently change.
create table if not exists public.instructor_statements (
  id              uuid primary key default gen_random_uuid(),
  instructor_id   uuid not null references public.instructors (id) on delete cascade,
  period          date not null,             -- first day of the month

  class_revenue_cents   integer not null default 0,
  instructor_share_cents integer not null default 0,
  equipment_cents       integer not null default 0,
  storage_cents         integer not null default 0,
  guaranteed_cents      integer not null default 0,
  net_payout_cents      integer not null default 0,

  -- Recorded, never deducted. It is the instructor's own cost.
  materials_cents       integer not null default 0,

  sessions_delivered    integer not null default 0,

  status          text not null default 'draft'
                    check (status in ('draft', 'paid')),
  paid_on         date,
  notes           text,
  created_at      timestamptz not null default now(),

  unique (instructor_id, period)
);

-- --- Defaults -----------------------------------------------------------------

insert into public.settings (key, value) values
  ('classes', '{
     "hub_split_percent": 30,
     "confirm_hours_before": 24,
     "earned_after_sessions": 10,
     "earned_min_average_attendance": 4
   }'),
  ('credits', '{
     "individual_price_cents": 4000,
     "individual_credits": 4,
     "family_price_cents": 7000,
     "family_credits": 8,
     "extra_credit_cents": 1200,
     "dropin_cents": 1300,
     "rollover_months": 2,
     "family_same_class_cap": 4
   }')
on conflict (key) do nothing;

-- --- Row level security -------------------------------------------------------

alter table public.instructors           enable row level security;
alter table public.equipment             enable row level security;
alter table public.storage_rentals       enable row level security;
alter table public.classes               enable row level security;
alter table public.class_equipment       enable row level security;
alter table public.class_sessions        enable row level security;
alter table public.enrolments            enable row level security;
alter table public.memberships           enable row level security;
alter table public.credit_ledger         enable row level security;
alter table public.instructor_statements enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'instructors','equipment','storage_rentals','classes','class_equipment',
    'class_sessions','enrolments','memberships','credit_ledger',
    'instructor_statements'
  ] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- --- What the public may see --------------------------------------------------

-- A published class and its sessions, so the classes page works signed out.
-- Note what is NOT here: materials_cost_cents lives on this row, so the
-- browser must never be handed the row. The app selects an explicit column
-- list for public pages, and the column is excluded from it.
drop policy if exists classes_public_read on public.classes;
create policy classes_public_read on public.classes
  for select using (is_public = true and status in ('open', 'full'));

drop policy if exists class_sessions_public_read on public.class_sessions;
create policy class_sessions_public_read on public.class_sessions
  for select using (
    exists (
      select 1 from public.classes c
      where c.id = class_sessions.class_id
        and c.is_public = true
        and c.status in ('open', 'full')
    )
  );

drop policy if exists instructors_public_read on public.instructors;
create policy instructors_public_read on public.instructors
  for select using (is_active = true);

-- Anyone may sign up for a class. Nobody may read the sign-up list back —
-- who attends a class is not public information.
drop policy if exists enrolments_public_insert on public.enrolments;
create policy enrolments_public_insert on public.enrolments
  for insert with check (true);

-- A member may see their own membership and their own credit history.
drop policy if exists memberships_own_read on public.memberships;
create policy memberships_own_read on public.memberships
  for select using (
    contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );

drop policy if exists credit_ledger_own_read on public.credit_ledger;
create policy credit_ledger_own_read on public.credit_ledger
  for select using (
    membership_id in (
      select m.id from public.memberships m
      join public.profiles p on p.contact_id = m.contact_id
      where p.id = auth.uid()
    )
  );

-- A member may see their own enrolments.
drop policy if exists enrolments_own_read on public.enrolments;
create policy enrolments_own_read on public.enrolments
  for select using (
    contact_id in (
      select contact_id from public.profiles
      where id = auth.uid() and contact_id is not null
    )
  );
