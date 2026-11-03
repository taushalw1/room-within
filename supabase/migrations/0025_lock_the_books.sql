-- ---------------------------------------------------------------------------
-- Closing a year.
--
-- Once the year-end pack has gone to the accountant and a return has been
-- filed on it, the numbers behind it must stop moving. Nothing in the app
-- prevented that until now: editing a 2025 expense in March 2026 silently
-- makes a filed return wrong, and absolutely nothing says so. It is the kind
-- of mistake discovered by a reassessment letter.
--
-- So a date can be set, and everything dated before it is frozen — no edits,
-- no deletions, and no back-dating something new into the closed period. It
-- is a setting rather than a one-way door, because a genuine late adjustment
-- does happen and the answer is to reopen deliberately, not to have never
-- been protected.
--
-- Enforced in the database rather than in the pages. A check in a server
-- action protects the one route somebody remembered to put it on; this
-- protects the table.
-- ---------------------------------------------------------------------------

create or replace function public.refuse_if_locked()
returns trigger
language plpgsql
as $$
declare
  locked   date;
  date_col text := TG_ARGV[0];
  subject  jsonb;
  row_date date;
begin
  select (value ->> 'date')::date
    into locked
  from public.settings
  where key = 'books_locked_before';

  if locked is null then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  -- The row as it would end up. For a delete, the row going away.
  subject  := to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end);
  row_date := (subject ->> date_col)::date;

  if row_date is not null and row_date < locked then
    raise exception
      'The books are closed up to %, so nothing dated % can be added or changed. Reopen the period in Settings first.',
      to_char(locked, 'DD Mon YYYY'), to_char(row_date, 'DD Mon YYYY')
      using errcode = 'check_violation';
  end if;

  -- An update is checked at both ends. Otherwise a row sitting inside the
  -- closed period could be dragged out of it — which changes a closed year's
  -- totals just as surely as editing the row in place.
  if TG_OP = 'UPDATE' then
    row_date := (to_jsonb(OLD) ->> date_col)::date;
    if row_date is not null and row_date < locked then
      raise exception
        'The books are closed up to %, and that record is dated %. Reopen the period in Settings first.',
        to_char(locked, 'DD Mon YYYY'), to_char(row_date, 'DD Mon YYYY')
        using errcode = 'check_violation';
    end if;
  end if;

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end $$;

-- Every table whose rows end up in the year-end pack, with the date that
-- decides which year each row belongs to. A table missing from this list is a
-- hole in the lock, so the list is the same one the pack is built from.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('expenses',        'incurred_on'),
      ('invoices',        'issue_date'),
      ('payments',        'paid_at'),
      ('donations',       'received_at'),
      ('bills',           'due_on'),
      ('trips',           'travelled_on'),
      ('invoice_credits', 'created_at')
    ) as v(table_name, date_col)
  loop
    execute format('drop trigger if exists %I on public.%I',
                   'refuse_if_locked_' || t.table_name, t.table_name);
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.refuse_if_locked(%L)',
      'refuse_if_locked_' || t.table_name, t.table_name, t.date_col);
  end loop;
end $$;
