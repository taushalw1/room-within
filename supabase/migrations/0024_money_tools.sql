-- ---------------------------------------------------------------------------
-- The five things she was still opening QuickBooks for.
--
-- Bank rules, bills she hasn't paid yet, costs that repeat, mileage, and
-- forgiving part of a rent. None of them needs double-entry bookkeeping; all
-- of them were the reason for a second subscription.
-- ---------------------------------------------------------------------------

-- --- 1. Bank rules -----------------------------------------------------------

-- "Anything from FORTIS ALBERTA is Utilities." Saves her categorising the
-- same direct debit twelve times a year.
--
-- A rule carries a direction and is only ever applied to lines going that
-- way. Without it a rule written for a payment out would happily fire on a
-- refund coming in and file the refund as a cost.
create table if not exists public.bank_rules (
  id          uuid primary key default gen_random_uuid(),

  /* Looked for anywhere in the bank's description, ignoring case. */
  match_text  text not null check (length(trim(match_text)) >= 3),
  direction   text not null check (direction in ('in', 'out')),

  /* What to file it as. Only meaningful for money going out. */
  category    text,
  vendor      text,

  /* Counted so a rule that never fires is visible as dead weight. */
  times_used  integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (match_text, direction)
);

drop trigger if exists bank_rules_touch on public.bank_rules;
create trigger bank_rules_touch
  before update on public.bank_rules
  for each row execute function public.touch_updated_at();

-- --- 2. Bills ------------------------------------------------------------------

-- What she owes and hasn't paid.
--
-- Until now a cost only existed once the money had gone, so a contractor's
-- invoice due in thirty days was invisible — including to the cash forecast,
-- which is exactly where it matters most. A bill is a promise to pay; an
-- expense is the payment. Keeping them apart is what lets the forecast see
-- what is coming.
create table if not exists public.bills (
  id            uuid primary key default gen_random_uuid(),

  vendor        text not null,
  description   text,
  category      text not null,

  amount_cents  integer not null check (amount_cents > 0),
  tax_cents     integer not null default 0 check (tax_cents >= 0),

  issued_on     date,
  due_on        date not null,

  status        text not null default 'open'
                  check (status in ('open', 'paid', 'void')),

  /* The cost it became once paid. One bill becomes one expense. */
  expense_id    uuid references public.expenses (id) on delete set null,
  unit_id       uuid references public.units (id) on delete set null,

  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  /* A bill cannot be marked paid without the cost it turned into. Otherwise
     "paid" is a claim with nothing behind it, and the money never appears in
     the books at all. */
  constraint bills_paid_has_expense check (
    status <> 'paid' or expense_id is not null
  )
);

create index if not exists bills_open_idx
  on public.bills (status, due_on) where status = 'open';
create unique index if not exists bills_one_expense
  on public.bills (expense_id) where expense_id is not null;

drop trigger if exists bills_touch on public.bills;
create trigger bills_touch
  before update on public.bills
  for each row execute function public.touch_updated_at();

-- --- 3. Costs that repeat ------------------------------------------------------

-- Insurance once a year, the gas every month. The forecast already infers
-- these from history, which works until the first year of history doesn't
-- exist or an amount changes. Written down, they are facts rather than
-- inferences.
create table if not exists public.recurring_costs (
  id            uuid primary key default gen_random_uuid(),

  vendor        text not null,
  category      text not null,
  amount_cents  integer not null check (amount_cents > 0),

  cadence       text not null
                  check (cadence in ('monthly', 'quarterly', 'yearly')),
  /* The next one expected. Moved forward when a bill is raised from it. */
  next_due      date not null,

  is_active     boolean not null default true,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists recurring_costs_due_idx
  on public.recurring_costs (is_active, next_due);

drop trigger if exists recurring_costs_touch on public.recurring_costs;
create trigger recurring_costs_touch
  before update on public.recurring_costs
  for each row execute function public.touch_updated_at();

-- --- 4. Mileage ----------------------------------------------------------------

-- Driving to Lethbridge for supplies is a deduction, and one almost nobody
-- claims because the record is a notebook in the glovebox.
--
-- The rate is stored on each trip rather than looked up when the year-end
-- pack is built. The CRA rate changes annually, and a 2025 trip must keep
-- 2025's rate for ever — a pack rebuilt in 2027 that silently reprices three
-- years of driving would be wrong in a way nobody would spot.
create table if not exists public.trips (
  id              uuid primary key default gen_random_uuid(),

  travelled_on    date not null,
  purpose         text not null,
  from_place      text,
  to_place        text,

  kilometres      numeric(8,1) not null check (kilometres > 0),
  rate_cents_per_km integer not null check (rate_cents_per_km > 0),

  /* Worked out once and stored, so the year-end total cannot disagree with
     the rows it came from. */
  amount_cents    integer generated always as
                    (round(kilometres * rate_cents_per_km)::integer) stored,

  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists trips_date_idx on public.trips (travelled_on desc);

-- --- 5. Forgiving part of a rent -----------------------------------------------

-- A credit against an invoice: a month halved after a boiler failure, a
-- goodwill reduction, a billing mistake. Until now the only options were to
-- void the whole invoice or leave it looking unpaid for ever, and neither is
-- what happened.
--
-- A separate row rather than an edit to the invoice, because the original
-- amount and the reason it was reduced are both part of the record.
create table if not exists public.invoice_credits (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices (id) on delete cascade,

  amount_cents  integer not null check (amount_cents > 0),
  reason        text not null check (length(trim(reason)) >= 3),

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists invoice_credits_invoice_idx
  on public.invoice_credits (invoice_id);

-- --- The invoice view, now that a credit can reduce a balance -----------------

-- The balance now subtracts credits as well as payments, and the state
-- follows from the balance exactly as it did — so nothing downstream has to
-- learn a new rule.
--
-- `credited_cents` is appended at the end rather than put beside
-- `paid_cents` where it belongs. `create or replace view` can only add
-- columns after the existing ones, and dropping the view to get a tidier
-- column order would take every policy and view built on it with it. Tidiness
-- is not worth that.
create or replace view public.invoice_balances
with (security_invoker = true)
as
select
  i.*,
  coalesce(p.paid_cents, 0)                                   as paid_cents,
  (i.amount_cents + i.tax_cents
     - coalesce(p.paid_cents, 0)
     - coalesce(c.credited_cents, 0))                         as balance_cents,
  case
    when i.status = 'void'  then 'void'
    when i.status = 'draft' then 'draft'
    when (i.amount_cents + i.tax_cents
            - coalesce(p.paid_cents, 0)
            - coalesce(c.credited_cents, 0)) <= 0 then 'paid'
    when i.due_date < current_date then 'overdue'
    else 'outstanding'
  end                                                         as state,
  (current_date - i.due_date)                                 as days_overdue,
  coalesce(c.credited_cents, 0)                               as credited_cents
from public.invoices i
left join (
  select invoice_id, sum(amount_cents) as paid_cents
  from public.payments
  where invoice_id is not null
  group by invoice_id
) p on p.invoice_id = i.id
left join (
  select invoice_id, sum(amount_cents) as credited_cents
  from public.invoice_credits
  group by invoice_id
) c on c.invoice_id = i.id;

-- --- Row level security -------------------------------------------------------

alter table public.bank_rules      enable row level security;
alter table public.bills           enable row level security;
alter table public.recurring_costs enable row level security;
alter table public.trips           enable row level security;
alter table public.invoice_credits enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'bank_rules', 'bills', 'recurring_costs', 'trips', 'invoice_credits'
  ] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- A tenant may see a credit against their own invoice. Without this the
-- portal would show a balance reduced for a reason they cannot see, which is
-- the sort of thing that generates a phone call rather than preventing one.
drop policy if exists invoice_credits_own_read on public.invoice_credits;
create policy invoice_credits_own_read on public.invoice_credits
  for select using (
    invoice_id in (
      select inv.id from public.invoices inv
      join public.profiles p on p.contact_id = inv.contact_id
      where p.id = auth.uid()
    )
  );
