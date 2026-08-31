-- ---------------------------------------------------------------------------
-- Stop the instructor's materials cost being readable by the public.
--
-- Migration 0004 gave `classes` a public read policy and relied on the app
-- selecting an explicit column list. That is not a protection. Row-level
-- security decides which *rows* are visible, not which columns, so anyone with
-- the anon key could ask the API for `select=*` and read
-- `materials_cost_cents` and `materials_note` for every published class.
--
-- Tausha was explicit that the materials figure is hers alone: "the
-- transparency is for me as the landlord, not for the customers." So the table
-- stops being publicly readable, and the public reads a view that simply does
-- not contain those two columns.
--
-- The view is deliberately NOT security_invoker. It runs as its owner and so
-- bypasses row-level security on `classes` — which is the point: the view is
-- the curated public projection, and its own WHERE clause is the filter.
-- ---------------------------------------------------------------------------

drop policy if exists classes_public_read on public.classes;

drop view if exists public.public_classes;

create view public.public_classes as
  select
    id,
    instructor_id,
    room_id,
    title,
    summary,
    description,
    session_minutes,
    capacity,
    full_price_cents,
    reduced_price_cents,
    subsidized_price_cents,
    subsidized_seat_cap,
    credit_cost,
    min_headcount,
    status,
    is_public,
    created_at
  from public.classes
  where is_public = true
    and status in ('open', 'full');

grant select on public.public_classes to anon, authenticated;

-- The sessions policy referenced `classes` directly. It still works — the
-- policy runs with the table owner's view of the row, not the caller's — but
-- restate it here so the whole public surface is described in one place.
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

-- Instructors: a bio and a name are meant to be public. Nothing else on that
-- table is, so restrict the grant to the columns the website shows rather than
-- leaving `notes`, `guaranteed_pay_cents` and `split_percent` reachable.
drop policy if exists instructors_public_read on public.instructors;

drop view if exists public.public_instructors;

create view public.public_instructors as
  select id, display_name, headline, bio, photo_url, standing
  from public.instructors
  where is_active = true;

grant select on public.public_instructors to anon, authenticated;
