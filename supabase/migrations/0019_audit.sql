-- ---------------------------------------------------------------------------
-- A record of what changed, who changed it, and when.
--
-- Two accounts share this building's admin area and an app makes changes on
-- its own — rent raised overnight, late fees charged, reminders sent. When a
-- figure is wrong the first question is always "when did that change?", and
-- without this the answer is a shrug.
--
-- It is done with triggers rather than by calling a logger from each action,
-- because a logger has to be remembered in forty places and this has to be
-- remembered in none. It also catches writes made with the service key, which
-- is exactly the kind nobody would think to log.
--
-- What is deliberately NOT audited: counselling appointments and notes. Those
-- are health information under Alberta's HIA, and copying them into a second
-- table that exists to be read later is the opposite of what that law is for.
-- A change to them leaves no trail here, on purpose.
--
-- Only the fields that actually changed are stored, so a row reads as a
-- sentence rather than as two copies of everything.
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),

  /* Null when the change came from the server's own key — a cron run, a
     webhook, a scheduled job. Shown as "the app did this". */
  actor       uuid references auth.users (id) on delete set null,
  actor_email text,

  table_name  text not null,
  row_id      text,
  action      text not null check (action in ('insert', 'update', 'delete')),

  /* Only what changed: { "rent_cents": { "from": 65000, "to": 70000 } } */
  changes     jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id, at desc);

alter table public.audit_log enable row level security;

-- Readable by admins. Writable by nobody through the API at all: the rows
-- arrive through the trigger, which runs as the table owner.
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
  for select using (public.is_admin());

-- A trail that can be edited is not a trail. This refuses every change and
-- removal for everyone, including the service key, the same way signatures
-- are protected.
create or replace function public.audit_log_is_final()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit trail cannot be % .', lower(tg_op);
end $$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.audit_log_is_final();

drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.audit_log_is_final();
