-- Admins: the people who can add users to the hub from inside the app.
--
-- Until now any staff member could change who has access. From here only an
-- admin can. Everyone on the team can still read the list of people who sign
-- in, because the contact log shows who logged each entry.

alter table public.profiles
  add column is_admin boolean not null default false,
  add column email text;

comment on column public.profiles.email is 'Copied from the sign-in account so the Users page can show it. The account itself holds the real one.';

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

-- The first staff member in the hub becomes its first admin.
update public.profiles set is_admin = true
where id = (select id from public.profiles where role = 'staff' order by created_at limit 1);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin and role in ('staff', 'coach') from public.profiles where id = auth.uid()), false) $$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy staff_profiles on public.profiles;
create policy team_read_profiles on public.profiles for select to authenticated using (public.is_team());
create policy admin_profiles on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Give a sign-in account access to the hub, or change the access it has.
-- The account must already exist (the Users page creates it first). This runs
-- with the database owner's rights because it has to look the account up by
-- email and mark it confirmed, so it checks for itself that the caller is an admin.
create function public.admin_grant_access(user_email text, name text, new_role text, make_admin boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  found_email text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can give someone access';
  end if;
  if new_role not in ('staff', 'coach') then
    raise exception 'Role must be staff or coach';
  end if;
  select id, email into uid, found_email from auth.users where lower(email) = lower(btrim(user_email));
  if uid is null then
    raise exception 'No sign-in exists for % yet', btrim(user_email);
  end if;
  if uid = auth.uid() then
    raise exception 'You cannot change your own access';
  end if;
  -- A new account may be waiting on a confirmation email. An admin adding them is the confirmation.
  update auth.users set email_confirmed_at = now() where id = uid and email_confirmed_at is null;
  insert into public.profiles (id, full_name, role, is_admin, email)
  values (uid, nullif(btrim(name), ''), new_role, coalesce(make_admin, false), found_email)
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name), role = excluded.role, is_admin = excluded.is_admin, email = excluded.email;
  return uid;
end $$;

revoke all on function public.admin_grant_access(text, text, text, boolean) from public, anon;
grant execute on function public.admin_grant_access(text, text, text, boolean) to authenticated;
