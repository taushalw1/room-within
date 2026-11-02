-- ---------------------------------------------------------------------------
-- The trigger that fills the audit trail, and the tables it watches.
--
-- Noise is the enemy of a trail nobody reads, so two things are left out:
-- `updated_at`, which changes on every write and says nothing, and any update
-- where nothing else actually changed.
-- ---------------------------------------------------------------------------

create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff     jsonb := '{}'::jsonb;
  key      text;
  old_json jsonb;
  new_json jsonb;
  who      uuid := auth.uid();
  who_email text;
begin
  if tg_op = 'INSERT' then
    new_json := to_jsonb(new);
    -- On a new row, record what it was created as rather than a diff against
    -- nothing.
    diff := new_json - 'updated_at' - 'created_at';
  elsif tg_op = 'DELETE' then
    old_json := to_jsonb(old);
    diff := old_json - 'updated_at' - 'created_at';
  else
    old_json := to_jsonb(old);
    new_json := to_jsonb(new);

    for key in select jsonb_object_keys(new_json) loop
      if key in ('updated_at') then
        continue;
      end if;
      if old_json -> key is distinct from new_json -> key then
        diff := diff || jsonb_build_object(
          key,
          jsonb_build_object('from', old_json -> key, 'to', new_json -> key)
        );
      end if;
    end loop;

    -- A write that changed nothing is not worth a line.
    if diff = '{}'::jsonb then
      return null;
    end if;
  end if;

  if who is not null then
    select email into who_email from public.profiles where id = who;
  end if;

  insert into public.audit_log (actor, actor_email, table_name, row_id, action, changes)
  values (
    who,
    who_email,
    tg_table_name,
    coalesce((to_jsonb(coalesce(new, old)) ->> 'id'), null),
    lower(tg_op),
    diff
  );

  return null;
end $$;

-- The tables where "when did that change?" is a question somebody will
-- actually ask. Counselling is deliberately absent — see 0019.
do $$
declare t text;
begin
  foreach t in array array[
    'leases', 'invoices', 'payments', 'expenses', 'deposit_entries',
    'move_outs', 'move_out_items', 'units', 'contacts', 'settings',
    'waiting_list', 'contractors', 'recurring_tasks', 'warranties',
    'late_fee_log', 'memberships'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_this on public.%I', t);
      execute format(
        'create trigger audit_this after insert or update or delete on public.%I
           for each row execute function public.audit_change()', t);
    end if;
  end loop;
end $$;
