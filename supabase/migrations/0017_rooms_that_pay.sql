-- ---------------------------------------------------------------------------
-- Which rooms actually pay, and who is waiting for one.
--
-- An expense can now be attached to a unit. Most can't — insurance, the
-- heating bill, the accountant — and those stay where they are rather than
-- being divided up by floor area, which would produce a figure that looks
-- precise and means nothing. Only what was genuinely spent on one room is
-- counted against it, and the page says so.
--
-- The waiting list is the other half of the same question. A room standing
-- empty costs its rent every month it stands empty, and the only thing that
-- shortens that is knowing who to ring.
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column if not exists unit_id uuid references public.units (id) on delete set null;

create index if not exists expenses_unit_idx on public.expenses (unit_id, incurred_on);

create table if not exists public.waiting_list (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text,
  phone        text,
  /* What they're after, in their words. */
  looking_for  text,
  /* Which kinds of unit would suit, so a vacancy can find its own candidates. */
  unit_kinds   text[] not null default '{}',
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  /* Roughly when they want it. Null means whenever. */
  needed_from  date,
  notes        text,
  status       text not null default 'waiting'
                 check (status in ('waiting', 'offered', 'housed', 'gone')),
  last_contacted_on date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists waiting_list_status_idx
  on public.waiting_list (status, created_at);

drop trigger if exists waiting_list_touch on public.waiting_list;
create trigger waiting_list_touch
  before update on public.waiting_list
  for each row execute function public.touch_updated_at();

alter table public.waiting_list enable row level security;

-- Hers alone. These are people's names, numbers and what they can afford.
drop policy if exists waiting_list_admin on public.waiting_list;
create policy waiting_list_admin on public.waiting_list
  for all using (public.is_admin()) with check (public.is_admin());

-- Anyone may put their own name down from the public site, and see nothing
-- else. Insert only — no select policy, so the list cannot be read back out.
drop policy if exists waiting_list_public_insert on public.waiting_list;
create policy waiting_list_public_insert on public.waiting_list
  for insert with check (true);
