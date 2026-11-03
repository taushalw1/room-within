-- ---------------------------------------------------------------------------
-- Ticking the books off against the bank.
--
-- The job this replaces is a statement, a pencil, and an hour. What makes it
-- worth storing rather than doing in the browser and throwing away is the
-- residue: the lines that match nothing. A payment that never arrived and a
-- direct debit nobody set up are both invisible everywhere else in the app,
-- and both only show up by comparing against the bank. If the unexplained
-- lines die when she closes the page, the comparison was for nothing.
--
-- So every line of every statement is kept, with what became of it. A line is
-- either matched to something we already recorded, turned into a new record,
-- or deliberately set aside with a reason. There is no fourth option and no
-- way to make a line quietly disappear.
--
-- Nothing in here is ever written automatically from a match proposal. The
-- app can suggest; only a person confirms. A wrong automatic match produces a
-- book that balances and is wrong, which is worse than one that visibly
-- doesn't.
-- ---------------------------------------------------------------------------

create table if not exists public.bank_imports (
  id            uuid primary key default gen_random_uuid(),

  -- What she uploaded, so two statements for the same month are tellable apart.
  filename      text,
  -- The span the file actually covered, taken from its own rows rather than
  -- from the filename.
  period_start  date,
  period_end    date,

  line_count    integer not null default 0,
  money_in_cents  integer not null default 0,
  money_out_cents integer not null default 0,

  -- How the file was read: which way round the dates were, how the signs were
  -- understood, which columns were used. Kept because a statement read the
  -- wrong way round is the one failure that produces a plausible result, and
  -- six months later this is the only way to tell that is what happened.
  reading       jsonb,

  imported_by   uuid references public.profiles (id) on delete set null,
  imported_at   timestamptz not null default now()
);

create index if not exists bank_imports_recent_idx
  on public.bank_imports (imported_at desc);

create table if not exists public.bank_lines (
  id            uuid primary key default gen_random_uuid(),
  import_id     uuid not null references public.bank_imports (id) on delete cascade,

  -- The row it came from in the uploaded file, so she can find it again.
  line_no       integer not null,

  occurred_on   date not null,
  description   text not null default '',
  -- Positive is money into the account, negative is money out. Same
  -- convention as the matching code, deliberately: a sign that means
  -- different things in two places is a sign that will be read wrongly.
  amount_cents  integer not null,

  status        text not null default 'open'
                  check (status in ('open', 'matched', 'added', 'ignored')),

  -- What it turned out to be. Exactly one of these is set once the status is
  -- 'matched' or 'added'; the check below enforces that rather than trusting
  -- the application to remember.
  payment_id    uuid references public.payments (id) on delete set null,
  expense_id    uuid references public.expenses (id) on delete set null,

  -- Required when a line is set aside, because "ignored" with no reason is
  -- indistinguishable from a mistake six months later.
  note          text,

  decided_by    uuid references public.profiles (id) on delete set null,
  decided_at    timestamptz,

  created_at    timestamptz not null default now(),

  unique (import_id, line_no),

  constraint bank_lines_settled_once check (
    case status
      when 'open'    then payment_id is null and expense_id is null
      when 'ignored' then payment_id is null and expense_id is null
                          and note is not null and length(trim(note)) > 0
      else (payment_id is not null) <> (expense_id is not null)
    end
  )
);

create index if not exists bank_lines_import_idx
  on public.bank_lines (import_id, line_no);

-- The question asked on every reconcile: has this record already been seen on
-- a statement? Indexed both ways because it is asked of payments and of
-- expenses separately.
create index if not exists bank_lines_payment_idx
  on public.bank_lines (payment_id) where payment_id is not null;
create index if not exists bank_lines_expense_idx
  on public.bank_lines (expense_id) where expense_id is not null;

create index if not exists bank_lines_open_idx
  on public.bank_lines (status, occurred_on) where status = 'open';

-- --- One record, one bank line -----------------------------------------------

-- A payment cannot be ticked off against two different statement lines. The
-- application avoids offering a record twice, but the application is not where
-- this belongs: a double-counted payment makes the books balance against money
-- that only arrived once.
create unique index if not exists bank_lines_one_payment
  on public.bank_lines (payment_id) where payment_id is not null;
create unique index if not exists bank_lines_one_expense
  on public.bank_lines (expense_id) where expense_id is not null;

-- --- Row level security -------------------------------------------------------

alter table public.bank_imports enable row level security;
alter table public.bank_lines   enable row level security;

-- Admins only, and deliberately no tenant-facing policy of any kind. A bank
-- statement names every other tenant who paid that month.
do $$
declare t text;
begin
  foreach t in array array['bank_imports', 'bank_lines'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
