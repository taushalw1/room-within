-- ---------------------------------------------------------------------------
-- A login for the accountant.
--
-- The alternative is exporting two files and emailing them, which is fine
-- once a year and tiresome every time a question comes back. A read-only
-- login answers the questions without Tausha in the middle.
--
-- Read-only is enforced by giving the role SELECT and nothing else. There is
-- deliberately no accountant INSERT, UPDATE or DELETE policy anywhere: an
-- accountant who needs a correction asks for it, and the correction is made
-- by the person whose books they are.
--
-- What they cannot see matters as much as what they can. No counselling
-- records, no maintenance reports, no inspections, no signatures, no
-- messages, and no contacts table — so an invoice shows a customer id and not
-- a person. An accountant preparing a T2125 needs the money, not the tenants.
--
-- `can_read_books` is deliberately NOT security definer. It only ever reads
-- the caller's own profile row, which `profiles_read_own` already permits, so
-- the usual recursion problem that forces `is_admin` to be definer does not
-- arise here.
-- ---------------------------------------------------------------------------

-- Allow the new role. The inline check from 0001 is named by Postgres
-- convention, but it is found rather than assumed, so a differently-named
-- constraint cannot leave two contradictory ones behind.
do $$
declare
  conname text;
begin
  for conname in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'tenant', 'member', 'accountant'));

create or replace function public.can_read_books()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'accountant')
  );
$$;

-- --- What they may read -------------------------------------------------------

-- The money, and the records the money is explained by. Each gets SELECT and
-- only SELECT.
do $$
declare t text;
begin
  foreach t in array array[
    'expenses', 'invoices', 'payments', 'donations',
    'bills', 'trips', 'recurring_costs', 'invoice_credits',
    'instructor_statements', 'instructors',
    'bank_imports', 'bank_lines',
    'units'
  ] loop
    execute format('drop policy if exists books_read on public.%I', t);
    execute format(
      'create policy books_read on public.%I for select
         using (public.can_read_books())', t);
  end loop;
end $$;

-- The settings the figures depend on — the GST rate, the mileage rate, where
-- the books are closed to. Without these an accountant looking at a total
-- cannot tell what it was worked out from.
drop policy if exists books_read_settings on public.settings;
create policy books_read_settings on public.settings
  for select using (public.can_read_books());
