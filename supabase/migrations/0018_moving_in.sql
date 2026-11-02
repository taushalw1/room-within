-- ---------------------------------------------------------------------------
-- The things you write down when somebody moves in.
--
-- All of these were being collected on paper or not at all, and every one of
-- them is wanted at an awkward moment rather than a convenient one: the
-- emergency contact when there is water coming through a ceiling at eleven at
-- night, the key count when somebody leaves and two don't come back, the
-- vehicle when a car has been in the wrong stall for a week.
--
-- They belong to the tenancy rather than the person, because they change when
-- the tenancy does — new lease, new keys, possibly a different next of kin.
-- ---------------------------------------------------------------------------

alter table public.leases
  add column if not exists emergency_name  text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_relationship text,
  /* How many keys, fobs and remotes went out. Checked back against the
     clean-out list at the end. */
  add column if not exists keys_issued integer check (keys_issued is null or keys_issued >= 0),
  add column if not exists vehicle text,
  add column if not exists parking_stall text,
  /* Anyone else living or working there, in plain words. */
  add column if not exists other_occupants text;

-- Where a tenancy came from, so the waiting list can show whether it works.
alter table public.leases
  add column if not exists from_waiting_list uuid
    references public.waiting_list (id) on delete set null;
