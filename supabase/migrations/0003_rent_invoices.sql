-- ============================================================================
-- Make monthly rent generation safe to run more than once.
--
-- The generator runs daily rather than monthly, so a missed day self-heals
-- instead of skipping a month's rent. That only works if a second run can't
-- raise a duplicate invoice — this index is what guarantees it, in the
-- database rather than in application logic that could be bypassed.
--
-- Partial, so it only constrains generated rent. Ad-hoc invoices, bookings and
-- counselling fees are unaffected.
-- ============================================================================

create unique index if not exists invoices_one_rent_per_lease_period
  on public.invoices (lease_id, period_start)
  where kind = 'rent' and lease_id is not null and period_start is not null;

comment on index public.invoices_one_rent_per_lease_period is
  'One rent invoice per lease per month. Lets the generator run daily and be idempotent.';
