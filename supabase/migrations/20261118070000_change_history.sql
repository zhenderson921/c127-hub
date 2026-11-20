-- Change history: who changed or removed what, kept so one mistake can be put
-- back without restoring the whole database.
--
-- Every insert, update and delete on the Live tool's tables is written to
-- change_log by a trigger. Changes made in one go (joining two people,
-- matching a church name, a spreadsheet load) share a `batch`, so they can be
-- looked at and put back together.

create table public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  changed_by uuid default auth.uid(),
  -- Kept as text too, so the entry still says who it was after a sign-in is removed.
  changed_by_name text,
  batch bigint not null default txid_current(),
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_row jsonb,
  new_row jsonb,
  -- Set on the entries written while putting an earlier batch back.
  undoes_batch bigint
);
create index change_log_batch_idx on public.change_log (batch);
create index change_log_at_idx on public.change_log (at desc);
create index change_log_row_idx on public.change_log (table_name, row_id);

alter table public.change_log enable row level security;
-- Staff and coaches can read the history. Nobody writes to it directly: only the trigger does.
create policy team_read on public.change_log for select to authenticated using (public.is_team());

create function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
begin
  -- An update that changed nothing is not worth a line.
  if tg_op = 'UPDATE' and o = n then
    return null;
  end if;
  insert into public.change_log (table_name, row_id, action, old_row, new_row, changed_by_name, undoes_batch)
  values (
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'key', case when r ? 'family_id' and r ? 'person_id' then (r ->> 'family_id') || ':' || (r ->> 'person_id') end, r ->> 'person_id'),
    lower(tg_op), o, n,
    (select coalesce(full_name, email) from public.profiles where id = auth.uid()),
    nullif(current_setting('c127.undoing', true), '')::bigint
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['churches', 'church_aliases', 'people', 'person_roles', 'advocate_onboarding', 'families', 'family_members',
                           'children', 'care_communities', 'interactions', 'tasks', 'vce_responses', 'visits', 'next_step_options', 'coaches'] loop
    execute format('create trigger zz_log_change after insert or update or delete on public.%I for each row execute function public.log_change()', t);
  end loop;
end $$;

-- Follow-ups are made by a trigger when a guest's answer is added. When an
-- answer is being restored from the history its follow-ups are restored too,
-- so the trigger must not make them a second time.
create or replace function public.route_vce_response() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  o record;
  to_coach uuid;
  to_queue text;
  guest text := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
begin
  if not new.needs_follow_up or nullif(current_setting('c127.undoing', true), '') is not null then
    return new;
  end if;
  for o in
    select distinct on (track) key, track, action, route, owner_id
    from public.next_step_options
    where key = any (new.next_steps) and active and route <> 'None'
    order by track, sort
  loop
    to_coach := null;
    to_queue := null;
    if o.route = 'Church coach' then
      select coach_id into to_coach from public.churches where id = new.church_id;
      if to_coach is null then to_queue := 'FAM'; end if;
    elsif o.route = 'Named owner' and o.owner_id is not null then
      to_coach := o.owner_id;
    elsif o.route = 'Named owner' then
      to_queue := case o.track when 'Give' then 'Development' when 'Foster' then 'Family Care' else 'Belong' end;
    else
      to_queue := 'Belong';
    end if;
    insert into public.tasks (coach_id, queue, title, about, due_on, kind, person_id, church_id, response_id, next_step_key)
    values (to_coach, to_queue, coalesce(o.action, o.track), guest, new.submitted_at::date + 2, 'Experience follow-up', new.person_id, new.church_id, new.id, o.key);
  end loop;
  return new;
end $$;

-- Put a batch back: remove what it added, restore what it removed, and set
-- changed fields back to what they were. Only the fields that batch changed
-- are touched, so later edits to other fields of the same record are kept.
-- Putting something back is itself recorded, so it can be undone too.
create function public.undo_batch(target bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- Parents before children, so restored rows find what they belong to.
  ordered text[] := array['coaches', 'churches', 'people', 'families', 'church_aliases', 'person_roles', 'advocate_onboarding', 'family_members',
                          'children', 'care_communities', 'visits', 'vce_responses', 'tasks', 'interactions', 'next_step_options'];
  t text;
  c record;
  pk text;
  sets text;
  removed integer := 0;
  restored integer := 0;
  reverted integer := 0;
  n integer;
  last_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can put a change back';
  end if;
  if not exists (select 1 from public.change_log where batch = target) then
    raise exception 'That change is not in the history';
  end if;
  if exists (select 1 from public.change_log where undoes_batch = target) then
    raise exception 'That change has already been put back';
  end if;
  perform set_config('c127.undoing', target::text, true);
  -- Only what was in the batch when this started: the lines this function writes must not be read back as part of it.
  select max(id) into last_id from public.change_log where batch = target;

  -- 1. Remove what the batch added, children first.
  for i in reverse array_length(ordered, 1)..1 loop
    t := ordered[i];
    select string_agg(format('%1$I = (jsonb_populate_record(null::public.%2$I, $1)).%1$I', a.attname, t), ' and ')
      into pk
      from pg_index x join pg_attribute a on a.attrelid = x.indrelid and a.attnum = any (x.indkey)
      where x.indrelid = format('public.%I', t)::regclass and x.indisprimary;
    for c in select new_row from public.change_log where batch = target and id <= last_id and table_name = t and action = 'insert' order by id desc loop
      execute format('delete from public.%I where %s', t, pk) using c.new_row;
      get diagnostics n = row_count;
      removed := removed + n;
    end loop;
  end loop;

  -- 2. Restore what it removed, parents first. A row that is somehow back already is left alone.
  foreach t in array ordered loop
    for c in select old_row from public.change_log where batch = target and id <= last_id and table_name = t and action = 'delete' order by id loop
      execute format('insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, $1) on conflict do nothing', t) using c.old_row;
      get diagnostics n = row_count;
      restored := restored + n;
    end loop;
  end loop;

  -- 3. Set changed fields back, newest change first so the oldest value wins.
  --    The row is found by where the change left it ($2), because the change may
  --    have moved it: joining two people re-points a family link, which is its key.
  foreach t in array ordered loop
    select string_agg(format('%1$I = (jsonb_populate_record(null::public.%2$I, $2)).%1$I', a.attname, t), ' and ')
      into pk
      from pg_index x join pg_attribute a on a.attrelid = x.indrelid and a.attnum = any (x.indkey)
      where x.indrelid = format('public.%I', t)::regclass and x.indisprimary;
    for c in select old_row, new_row from public.change_log where batch = target and id <= last_id and table_name = t and action = 'update' order by id desc loop
      select string_agg(format('%1$I = (jsonb_populate_record(null::public.%2$I, $1)).%1$I', k.key, t), ', ')
        into sets
        from jsonb_each(c.old_row) k
        where k.value is distinct from c.new_row -> k.key
          and exists (select 1 from information_schema.columns col where col.table_schema = 'public' and col.table_name = t and col.column_name = k.key);
      if sets is not null then
        execute format('update public.%I set %s where %s', t, sets, pk) using c.old_row, c.new_row;
        get diagnostics n = row_count;
        reverted := reverted + n;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('removed', removed, 'restored', restored, 'reverted', reverted);
end $$;

revoke all on function public.log_change() from public, anon, authenticated;
revoke all on function public.undo_batch(bigint) from public, anon;
grant execute on function public.undo_batch(bigint) to authenticated;

-- A contact log entry keeps its author's name even after that person's sign-in is removed.
alter table public.interactions add column logged_by_name text;
update public.interactions i set logged_by_name = coalesce(p.full_name, p.email) from public.profiles p where p.id = i.logged_by;

create function public.stamp_logged_by_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.logged_by_name is null and new.logged_by is not null then
    select coalesce(full_name, email) into new.logged_by_name from public.profiles where id = new.logged_by;
  end if;
  return new;
end $$;
create trigger stamp_logged_by_name before insert on public.interactions
  for each row execute function public.stamp_logged_by_name();
revoke all on function public.stamp_logged_by_name() from public, anon, authenticated;

revoke all on all tables in schema public from anon;
