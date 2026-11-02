-- ---------------------------------------------------------------------------
-- Looking after a 1905 building.
--
-- Three things that are currently in Tausha's head and nowhere else: who she
-- calls for what, the jobs that come round whether or not anybody remembers
-- them, and what is still under warranty.
--
-- The last of those is the one that costs real money. A furnace replaced four
-- years ago with a ten-year parts warranty is worth nothing at all if nobody
-- can find the paperwork on the morning it stops.
-- ---------------------------------------------------------------------------

create table if not exists public.contractors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  trade       text not null,
  phone       text,
  email       text,
  notes       text,
  /* How it went last time, in her own words — more use than a star rating. */
  how_it_went text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contractors_trade_idx on public.contractors (trade, name);

drop trigger if exists contractors_touch on public.contractors;
create trigger contractors_touch
  before update on public.contractors
  for each row execute function public.touch_updated_at();

-- Who did a given repair, so the history is worth reading back.
alter table public.maintenance_requests
  add column if not exists contractor_id uuid references public.contractors (id) on delete set null;

-- --- Jobs that come round -----------------------------------------------------

create table if not exists public.recurring_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  detail        text,
  unit_id       uuid references public.units (id) on delete set null,
  /* Null means the whole building. */
  area          text,
  every_months  integer not null check (every_months between 1 and 60),
  last_done_on  date,
  next_due_on   date not null,
  contractor_id uuid references public.contractors (id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists recurring_tasks_due_idx
  on public.recurring_tasks (is_active, next_due_on);

drop trigger if exists recurring_tasks_touch on public.recurring_tasks;
create trigger recurring_tasks_touch
  before update on public.recurring_tasks
  for each row execute function public.touch_updated_at();

-- --- What is still covered ----------------------------------------------------

create table if not exists public.warranties (
  id           uuid primary key default gen_random_uuid(),
  item         text not null,
  unit_id      uuid references public.units (id) on delete set null,
  supplier     text,
  supplier_phone text,
  purchased_on date,
  expires_on   date,
  cost_cents   integer check (cost_cents is null or cost_cents >= 0),
  /* The receipt or the warranty card, in the private maintenance bucket. */
  document_path text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists warranties_expiry_idx on public.warranties (expires_on);

drop trigger if exists warranties_touch on public.warranties;
create trigger warranties_touch
  before update on public.warranties
  for each row execute function public.touch_updated_at();

-- --- Row level security -------------------------------------------------------

-- All three are hers alone. A tenant has no business knowing what the
-- plumber charges or which supplier is owed a phone call.
alter table public.contractors     enable row level security;
alter table public.recurring_tasks enable row level security;
alter table public.warranties      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contractors', 'recurring_tasks', 'warranties'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
