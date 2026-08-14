-- ============================================================================
-- Starter data for Room Within Community.
--
-- Run AFTER migrations/0001_init.sql. Safe to re-run — it won't duplicate.
-- Edit the names, rates and capacities to match the real building before you
-- run it; these are the same sample spaces the app shows in demo mode.
-- ============================================================================

-- --- Rooms people can book ---------------------------------------------------
insert into public.rooms
  (name, slug, description, capacity, hourly_rate_cents,
   half_day_rate_cents, full_day_rate_cents, min_hours, buffer_minutes,
   is_bookable, requires_approval, sort_order)
values
  ('The Gathering Room', 'gathering-room',
   'Our largest space, at the front of the building. Suits classes, coffee groups, workshops, meetings and small celebrations. Tables and stacking chairs included, kitchenette next door.',
   40, 3500, 12000, 20000, 2, 30, true, true, 1),

  ('The Maker Space', 'maker-space',
   'Sewing machines, work tables and craft storage. Ideal for skill-sharing evenings, sewing circles, painting classes and children''s craft sessions.',
   16, 2500, 9000, 15000, 2, 30, true, true, 2),

  ('The Quiet Room', 'quiet-room',
   'A small, softly furnished room for one-to-one meetings, mentoring, tutoring and counselling. Private and sound-buffered.',
   4, 2000, 7000, 11000, 1, 15, true, false, 3),

  ('The Studio Office', 'studio-office',
   'A bright upstairs office available by the day for remote workers and visiting practitioners. Desk, wifi and shared kitchen access.',
   2, 1500, 5000, 8000, 1, 0, true, false, 4)
on conflict (slug) do nothing;

-- --- Rentable units ----------------------------------------------------------
insert into public.units (name, kind, floor, description, monthly_rate_cents, sort_order)
select * from (values
  ('Office 1 — Front', 'office', 'Main',  'Street-facing office with the big window.', 65000, 1),
  ('Office 2 — Rear',  'office', 'Main',  'Quieter back office.',                      55000, 2),
  ('Suite 1',          'suite',  'Upper', 'One-bedroom residential suite.',            95000, 3),
  ('Suite 2',          'suite',  'Upper', 'Studio suite with the outside stair.',      85000, 4)
) as v(name, kind, floor, description, monthly_rate_cents, sort_order)
where not exists (select 1 from public.units where units.name = v.name);

-- --- Settings ----------------------------------------------------------------
insert into public.settings (key, value) values
  ('rates',     '{"counselling_hourly_cents": 14000, "gst_rate": 0.05}'),
  ('reminders', '{"upcoming_days_before": 3, "overdue_days": [3, 7, 14]}'),
  ('business',  '{"name": "Room Within Community", "town": "Grassy Lake, Alberta"}')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ============================================================================
-- MAKE TAUSHA AN ADMIN
--
-- Do this AFTER she has signed in once (the sign-in creates her profile row).
-- Replace the email address, then run:
--
--   update public.profiles
--   set role = 'admin'
--   where email = 'her-address@example.com';
--
-- Check it worked:
--   select email, role from public.profiles;
-- ============================================================================
