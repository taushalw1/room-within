-- ---------------------------------------------------------------------------
-- Late fees, and the morning note.
--
-- Late fees are off until Tausha turns them on, and they stay off after this
-- migration runs. A fee charged automatically to a tenant who has never been
-- told it exists is not a feature, it is a letter from a lawyer — and in
-- Alberta a fee has to be set out in the agreement before it can be charged
-- at all. So the switch lives in settings, starts false, and the admin page
-- says plainly what turning it on will do.
--
-- A fee is charged once per invoice, never monthly on the same debt, which is
-- the behaviour that turns a missed payment into something nobody can climb
-- out of. The log enforces that rather than the code remembering to.
-- ---------------------------------------------------------------------------

insert into public.settings (key, value) values
  ('late_fees', '{
     "enabled": false,
     "grace_days": 5,
     "kind": "fixed",
     "amount_cents": 2500,
     "percent": 0,
     "max_cents": 5000,
     "applies_to": ["rent"]
   }'),
  ('digest', '{"enabled": true}')
on conflict (key) do nothing;

-- One fee per invoice, forever. The unique constraint is the rule; the code
-- that checks before charging is only there to produce a tidier log.
create table if not exists public.late_fee_log (
  invoice_id     uuid primary key references public.invoices (id) on delete cascade,
  fee_invoice_id uuid references public.invoices (id) on delete set null,
  amount_cents   integer not null,
  charged_on     date not null default current_date,
  created_at     timestamptz not null default now()
);

alter table public.late_fee_log enable row level security;

drop policy if exists late_fee_log_admin on public.late_fee_log;
create policy late_fee_log_admin on public.late_fee_log
  for all using (public.is_admin()) with check (public.is_admin());

-- A tenant should be able to see that a fee was charged against their own
-- invoice — it is their money, and a charge they cannot see is one they
-- cannot query.
drop policy if exists late_fee_log_own_read on public.late_fee_log;
create policy late_fee_log_own_read on public.late_fee_log
  for select using (
    invoice_id in (
      select id from public.invoices where contact_id = public.my_contact_id()
    )
  );
