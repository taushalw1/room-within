-- ---------------------------------------------------------------------------
-- Which columns a tenant may actually change.
--
-- Row-level security decides which rows somebody can touch, never which
-- columns. The policies in 0011 let a tenant update their own move-out and
-- their own checklist lines — and that is correct — but an update is an
-- update: nothing in a policy stops the same request from also setting the
-- charge against a line, or marking the walk-through done, or pointing the
-- signature at a different record.
--
-- The application only ever sends the two fields it should. That is a promise
-- made by code, and code is not where this promise belongs: anyone holding a
-- session can call the API directly. So the columns that are Tausha's are held
-- to their previous values here, in a trigger, for anybody who is not an
-- admin.
-- ---------------------------------------------------------------------------

-- The two callers that are allowed to set the rest: Tausha, signed in as an
-- admin, and the server itself holding the service key. The service key never
-- reaches a browser, so "service_role" here means this application's own code,
-- not a tenant with a crafted request.
create or replace function public.is_landlord_side()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role' or public.is_admin();
$$;

create or replace function public.move_out_items_tenant_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_landlord_side() then
    return new;
  end if;

  -- A tenant ticks their own box and writes their own note. Everything else
  -- stays exactly as it was, whatever the request asked for.
  new.move_out_id     := old.move_out_id;
  new.position        := old.position;
  new.area            := old.area;
  new.title           := old.title;
  new.detail          := old.detail;
  new.checked_by_admin := old.checked_by_admin;
  new.admin_note      := old.admin_note;
  new.charge_cents    := old.charge_cents;
  new.photo_path      := old.photo_path;
  new.created_at      := old.created_at;

  return new;
end $$;

drop trigger if exists move_out_items_tenant_columns on public.move_out_items;
create trigger move_out_items_tenant_columns
  before update on public.move_out_items
  for each row execute function public.move_out_items_tenant_columns();

create or replace function public.move_outs_tenant_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_landlord_side() then
    return new;
  end if;

  -- A tenant says where to send things. The date they are leaving, the state
  -- of the move-out, the walk-through and the link to their signature are all
  -- set elsewhere and are not theirs to move.
  new.lease_id               := old.lease_id;
  new.unit_id                := old.unit_id;
  new.contact_id             := old.contact_id;
  new.leaving_on             := old.leaving_on;
  new.status                 := old.status;
  new.inspected_on           := old.inspected_on;
  new.inspection_notes       := old.inspection_notes;
  new.tenant_signature_event := old.tenant_signature_event;
  new.created_at             := old.created_at;

  return new;
end $$;

drop trigger if exists move_outs_tenant_columns on public.move_outs;
create trigger move_outs_tenant_columns
  before update on public.move_outs
  for each row execute function public.move_outs_tenant_columns();
