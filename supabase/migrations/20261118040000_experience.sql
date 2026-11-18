-- Experience follow-up. When a guest's "My Next Steps" answer arrives, the
-- database works out who should follow up on each thing they ticked and puts
-- it on that person's list, or in a shared queue. The rules are C127's own
-- flow chart, held as rows in next_step_options so staff can change them.

-- False for an old answer that the spreadsheet already marks as followed up.
alter table public.vce_responses add column needs_follow_up boolean not null default true;

-- One follow-up per kind of next step the guest ticked.
--   Church coach:  the coach of the guest's church. With no matched church, or
--                  no coach, it goes to the FAM team's shared queue.
--   Named owner:   the person set on the option. With nobody set, a shared
--                  queue: Development for giving, Family Care for fostering,
--                  Belong for the rest.
--   Shared queue:  the Belong inbox, for whoever is in that day.
--   None:          nothing to do.
create function public.route_vce_response() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  o record;
  to_coach uuid;
  to_queue text;
  guest text := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
begin
  if not new.needs_follow_up then
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

create trigger route_vce_response after insert on public.vce_responses
  for each row execute function public.route_vce_response();

-- Matching a typed church name now also covers guests' answers: the answer
-- gets its church, and any open follow-up waiting in the FAM queue for that
-- church moves to the church's coach.
create or replace function public.match_church_name(typed text, church uuid) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  k text := lower(btrim(typed));
  ids uuid[];
  home_count integer;
  serving_count integer;
  people_count integer;
  guest_count integer;
  church_coach uuid;
begin
  if not public.is_team() then
    raise exception 'Only C127 staff can match church names';
  end if;
  if k is null or k = '' then
    raise exception 'No name given';
  end if;
  if not exists (select 1 from public.churches where id = church) then
    raise exception 'That church is not in the list';
  end if;

  insert into public.church_aliases (church_id, alias) values (church, btrim(typed)) on conflict do nothing;

  update public.families set home_church_id = church, home_church_text = null
  where home_church_id is null and lower(btrim(home_church_text)) = k;
  get diagnostics home_count = row_count;

  with f as (
    update public.families set church_id = church, serving_church_text = null
    where church_id is null and lower(btrim(serving_church_text)) = k
    returning id
  )
  select coalesce(array_agg(id), '{}') into ids from f;
  serving_count := cardinality(ids);
  update public.care_communities set church_id = church where church_id is null and family_id = any (ids);

  with p as (
    update public.people set home_church_id = church, home_church_text = null
    where home_church_id is null and lower(btrim(home_church_text)) = k
    returning id
  )
  select coalesce(array_agg(id), '{}') into ids from p;
  people_count := cardinality(ids);
  delete from public.person_roles r
  where r.church_id is null and r.person_id = any (ids) and r.role in ('Advocate', 'Point Person')
    and exists (select 1 from public.person_roles x where x.person_id = r.person_id and x.role = r.role and x.church_id = church);
  update public.person_roles set church_id = church
  where church_id is null and person_id = any (ids) and role in ('Advocate', 'Point Person');
  update public.advocate_onboarding set church_id = church where church_id is null and person_id = any (ids);

  with r as (
    update public.vce_responses set church_id = church
    where church_id is null and lower(btrim(home_church_text)) = k
    returning id
  )
  select coalesce(array_agg(id), '{}') into ids from r;
  guest_count := cardinality(ids);
  select coach_id into church_coach from public.churches where id = church;
  update public.tasks t set church_id = church,
    coach_id = case when church_coach is not null and t.queue = 'FAM' and not t.done then church_coach else t.coach_id end,
    queue = case when church_coach is not null and t.queue = 'FAM' and not t.done then null else t.queue end
  where t.response_id = any (ids);

  return jsonb_build_object('home', home_count, 'serving', serving_count, 'people', people_count, 'guests', guest_count);
end $$;

-- The one-step load can now bring in Center visits and form answers as well.
create or replace function public.import_records(payload jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  t text;
  cols text;
  n integer;
  result jsonb := '{}'::jsonb;
begin
  if not public.is_team() then
    raise exception 'Only C127 staff can load records';
  end if;
  foreach t in array array['coaches', 'churches', 'church_aliases', 'people', 'person_roles', 'advocate_onboarding',
                           'families', 'family_members', 'children', 'care_communities', 'visits', 'vce_responses'] loop
    if jsonb_typeof(payload -> t) = 'array' and jsonb_array_length(payload -> t) > 0 then
      select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into cols
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t
        and c.column_name in (select jsonb_object_keys(e) from jsonb_array_elements(payload -> t) e);
      if cols is null then
        raise exception 'No known columns in the rows for %', t;
      end if;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)', t, cols, cols, t)
        using payload -> t;
      get diagnostics n = row_count;
      result := result || jsonb_build_object(t, n);
    end if;
  end loop;
  return result;
end $$;
