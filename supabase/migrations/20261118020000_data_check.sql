-- Data check: load everything now, and let C127 staff confirm the uncertain
-- parts afterwards on the Live tool's "Data check" page.
--
-- A church name the spreadsheet typed in shorthand is kept as typed until a
-- person says which church it is. Possible duplicates are shown side by side
-- and either merged or marked as not the same.

-- The serving church as typed, kept until it is matched. (home_church_text already exists.)
alter table public.families add column serving_church_text text;
comment on column public.families.serving_church_text is
  'The serving church as the spreadsheet typed it, kept until someone matches it to a church on the Data check page.';

-- An advocate can be loaded before their church is matched.
alter table public.advocate_onboarding alter column church_id drop not null;

-- "We looked at this and it is fine as it is", so the item stops being asked about.
--   church_name: key is the typed name, lower case and trimmed
--   people, families, churches: key is the two ids, smaller first, joined by ':'
create table public.review_dismissals (
  kind text not null check (kind in ('church_name', 'people', 'families', 'churches')),
  key text not null,
  decided_by uuid references auth.users (id) on delete set null default auth.uid(),
  decided_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.review_dismissals enable row level security;
create policy team_all on public.review_dismissals for all to authenticated using (public.is_team()) with check (public.is_team());

-- "This typed name is that church." Applies to every family and person carrying
-- the name, remembers the spelling for later loads, and does it all or nothing.
create function public.match_church_name(typed text, church uuid) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  k text := lower(btrim(typed));
  ids uuid[];
  home_count integer;
  serving_count integer;
  people_count integer;
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
  -- A Care Community loaded for one of those families belongs to the same church.
  update public.care_communities set church_id = church where church_id is null and family_id = any (ids);

  with p as (
    update public.people set home_church_id = church, home_church_text = null
    where home_church_id is null and lower(btrim(home_church_text)) = k
    returning id
  )
  select coalesce(array_agg(id), '{}') into ids from p;
  people_count := cardinality(ids);
  -- Advocates who were waiting on this church. Drop a waiting role the person already holds there.
  delete from public.person_roles r
  where r.church_id is null and r.person_id = any (ids) and r.role in ('Advocate', 'Point Person')
    and exists (select 1 from public.person_roles x where x.person_id = r.person_id and x.role = r.role and x.church_id = church);
  update public.person_roles set church_id = church
  where church_id is null and person_id = any (ids) and role in ('Advocate', 'Point Person');
  update public.advocate_onboarding set church_id = church where church_id is null and person_id = any (ids);

  return jsonb_build_object('home', home_count, 'serving', serving_count, 'people', people_count);
end $$;

-- "These two records are the same person." Everything attached to `remove`
-- moves to `keep`, blanks on `keep` are filled from `remove`, and `remove` goes.
create function public.merge_people(keep uuid, remove uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_team() then
    raise exception 'Only C127 staff can merge people';
  end if;
  if keep = remove or not exists (select 1 from public.people where id = keep) or not exists (select 1 from public.people where id = remove) then
    raise exception 'Pick two different people who are both in the hub';
  end if;

  update public.people k set
    last_name = coalesce(k.last_name, r.last_name), email = coalesce(k.email, r.email), phone = coalesce(k.phone, r.phone),
    street = coalesce(k.street, r.street), unit = coalesce(k.unit, r.unit), city = coalesce(k.city, r.city),
    state = coalesce(k.state, r.state), zip = coalesce(k.zip, r.zip), county = coalesce(k.county, r.county),
    home_church_id = coalesce(k.home_church_id, r.home_church_id),
    home_church_text = case when coalesce(k.home_church_id, r.home_church_id) is null then coalesce(k.home_church_text, r.home_church_text) end,
    owner_id = coalesce(k.owner_id, r.owner_id), birthday = coalesce(k.birthday, r.birthday), shirt_size = coalesce(k.shirt_size, r.shirt_size),
    notes = nullif(concat_ws(E'\n', k.notes, r.notes), '')
  from public.people r
  where k.id = keep and r.id = remove;

  delete from public.family_members m
  where m.person_id = remove and exists (select 1 from public.family_members x where x.family_id = m.family_id and x.person_id = keep);
  update public.family_members set person_id = keep where person_id = remove;

  delete from public.person_roles r
  where r.person_id = remove
    and exists (select 1 from public.person_roles x where x.person_id = keep and x.role = r.role and x.church_id is not distinct from r.church_id);
  update public.person_roles set person_id = keep where person_id = remove;

  if exists (select 1 from public.advocate_onboarding where person_id = keep) then
    delete from public.advocate_onboarding where person_id = remove;
  else
    update public.advocate_onboarding set person_id = keep where person_id = remove;
  end if;

  update public.interactions set person_id = keep where person_id = remove;
  update public.tasks set person_id = keep where person_id = remove;
  update public.visits set person_id = keep where person_id = remove;
  update public.vce_responses set person_id = keep where person_id = remove;

  delete from public.people where id = remove;
end $$;

revoke all on function public.match_church_name(text, uuid), public.merge_people(uuid, uuid) from public, anon;
grant execute on function public.match_church_name(text, uuid), public.merge_people(uuid, uuid) to authenticated;
revoke all on all tables in schema public from anon;
