-- ---------------------------------------------------------------------------
-- Grants and conferences.
--
-- One table for both, because they are the same shape of thing — something
-- outside the building that Tausha might pursue, that has a deadline, a cost
-- or an award attached, and that moves through the same handful of states.
-- Keeping them together also means a conference can point at the grants that
-- would pay for the trip without a second set of joins.
--
-- Everything here is admin-only. There is no public policy on any of it.
--
-- A note on provenance. Most of these rows arrive from a weekly search that
-- reads the open web. A model reading grant pages will sometimes get a
-- deadline or an eligibility rule subtly wrong, and acting on a wrong deadline
-- costs a real application. So every row keeps the page it came from, is
-- marked unverified until Tausha has looked at that page herself, and the
-- interface never presents an unverified deadline as settled fact.
-- ---------------------------------------------------------------------------

create table if not exists public.opportunities (
  id            uuid primary key default gen_random_uuid(),

  kind          text not null check (kind in ('grant', 'conference')),

  title         text not null,
  organisation  text,                      -- the funder, or the host
  summary       text,
  url           text,                      -- the official page
  why_relevant  text,                      -- why this suits Room Within

  -- Grants
  amount_min_cents integer check (amount_min_cents >= 0),
  amount_max_cents integer check (amount_max_cents >= 0),
  deadline         date,
  eligibility      text,
  -- Marks a grant that would help pay to attend something, so a conference
  -- can list the funding that might cover it.
  covers_travel    boolean not null default false,

  -- Conferences
  starts_on     date,
  ends_on       date,
  location      text,
  is_online     boolean not null default false,
  cost_cents    integer check (cost_cents >= 0),
  cost_note     text,                      -- "early bird until 1 March"

  -- Where it sits in her pipeline.
  --   new           — turned up, not looked at
  --   interested     — worth pursuing
  --   not_interested — looked at, not for us
  --   applied        — application sent / ticket booked
  --   awarded        — we got it
  --   rejected       — they said no
  status        text not null default 'new'
                  check (status in ('new', 'interested', 'not_interested',
                                    'applied', 'awarded', 'rejected')),

  -- Archiving is separate from status: anything can be put away without
  -- losing what happened to it.
  archived_at   timestamptz,

  notes         text,

  -- Provenance
  source        text not null default 'search'
                  check (source in ('search', 'manual')),
  confidence    text check (confidence in ('high', 'medium', 'low')),
  -- Set when Tausha has opened the official page and confirmed the details.
  verified_at   timestamptz,
  found_at      timestamptz not null default now(),

  -- Stops the weekly search from adding the same thing over and over.
  fingerprint   text not null unique,

  created_at    timestamptz not null default now()
);

create index if not exists opportunities_kind_status_idx
  on public.opportunities (kind, status, archived_at);
create index if not exists opportunities_deadline_idx
  on public.opportunities (deadline) where deadline is not null;
create index if not exists opportunities_starts_idx
  on public.opportunities (starts_on) where starts_on is not null;

-- --- The application checklist -----------------------------------------------

-- Written when a grant is first marked interesting. Plain steps, in order,
-- each one small enough to finish in a sitting.
create table if not exists public.opportunity_steps (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.opportunities (id) on delete cascade,

  position        integer not null,
  title           text not null,
  detail          text,

  done_at         timestamptz,
  created_at      timestamptz not null default now(),

  unique (opportunity_id, position)
);

create index if not exists opportunity_steps_parent_idx
  on public.opportunity_steps (opportunity_id, position);

-- --- A record of each weekly search ------------------------------------------

create table if not exists public.research_runs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('grant', 'conference')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  found         integer not null default 0,
  added         integer not null default 0,
  status        text not null default 'running'
                  check (status in ('running', 'ok', 'failed', 'skipped')),
  message       text
);

create index if not exists research_runs_when_idx
  on public.research_runs (started_at desc);

-- --- What the search is looking for -------------------------------------------

-- Editable on the settings page, so what it hunts for can change as the
-- project does without anybody touching code.
insert into public.settings (key, value) values
  ('research', '{
     "enabled": true,
     "profile": "Room Within Community is a sole proprietorship in Grassy Lake, Alberta, Canada, restoring a historic 1905 building into a community hub. It offers rooms to rent by the hour or day, offices and suites to let, community classes taught by local people on a sliding scale, a maker space, and counselling. Priorities are the building purchase and repairs, heritage restoration, rural community development, adult and intergenerational learning, and childcare.",
     "grant_notes": "Prefer Alberta and Canada-wide funders: provincial and federal programs, municipal and county grants, rural and agricultural societies, heritage and main-street restoration funds, community foundations, and private foundations that fund rural community infrastructure. Include grants that pay for travel or professional development.",
     "conference_notes": "Conferences, trade shows and training relevant to running a rural community hub: community development, heritage building restoration, nonprofit and small business operations, rural economic development, childcare and early learning, and shared or coworking space management. Prefer Alberta and western Canada, and anything available online.",
     "max_results": 12
   }')
on conflict (key) do nothing;

-- --- Row level security -------------------------------------------------------

alter table public.opportunities      enable row level security;
alter table public.opportunity_steps  enable row level security;
alter table public.research_runs      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['opportunities', 'opportunity_steps', 'research_runs'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
