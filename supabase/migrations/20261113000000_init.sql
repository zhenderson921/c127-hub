-- C127 Hub: first schema.
-- Run once in a new, empty Supabase project (SQL Editor, or `supabase db push`).
-- Every table has row level security on. A signed-in person with no profile row sees nothing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- People who sign in
-- ---------------------------------------------------------------------------
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  created_at timestamptz not null default now()
);

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  town text,
  county text,
  zip text,
  lat double precision,
  lng double precision,
  coach_id uuid references public.coaches (id) on delete set null,
  stage text not null default 'Prospect'
    check (stage in ('Prospect', 'Exploring', 'Clinic scheduled', 'Launching', 'Active FAM', 'Paused')),
  advocate_name text,
  capacity integer not null default 0 check (capacity >= 0),
  last_contact_at timestamptz,
  launched_on date,
  created_at timestamptz not null default now()
);

-- One row per person who can sign in. role decides what they can see.
--   staff:    everything
--   coach:    everything (their own work is a filter in the app, not a wall)
--   advocate: only their own church, its families, volunteers and care requests
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null check (role in ('staff', 'coach', 'advocate')),
  coach_id uuid references public.coaches (id) on delete set null,
  church_id uuid references public.churches (id) on delete set null,
  created_at timestamptz not null default now(),
  check (role <> 'advocate' or church_id is not null)
);

-- ---------------------------------------------------------------------------
-- Families, volunteers and care
-- ---------------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'Foster' check (type in ('Foster', 'Adoptive', 'Kinship', 'Reunification')),
  town text,
  county text,
  zip text,
  lat double precision,
  lng double precision,
  children integer not null default 1 check (children >= 0),
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Closed')),
  church_id uuid references public.churches (id) on delete set null,
  care_community boolean not null default false,
  email text,
  phone text,
  source text not null default 'Import',
  since date not null default current_date,
  last_contact_at timestamptz,
  created_at timestamptz not null default now()
);
create index families_church_idx on public.families (church_id);
create index families_name_zip_idx on public.families (lower(name), zip);

create table public.volunteers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  church_id uuid not null references public.churches (id) on delete cascade,
  role text not null default 'Care Community'
    check (role in ('Advocate', 'Care Community', 'Meals', 'Childcare', 'Driver', 'Prayer')),
  background text not null default 'Not required' check (background in ('Cleared', 'Pending', 'Expired', 'Not required')),
  training text not null default 'Not started' check (training in ('Complete', 'In progress', 'Not started')),
  created_at timestamptz not null default now()
);
create index volunteers_church_idx on public.volunteers (church_id);

create table public.needs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  type text not null check (type in ('Meal', 'Childcare', 'Transportation', 'Tangible item', 'Home & yard', 'Tutoring', 'Prayer')),
  title text not null,
  needed_on date not null,
  status text not null default 'Open' check (status in ('Open', 'Claimed', 'Completed')),
  volunteer_id uuid references public.volunteers (id) on delete set null,
  hours numeric(5, 2) not null default 0 check (hours >= 0),
  created_at timestamptz not null default now()
);
create index needs_church_idx on public.needs (church_id, needed_on);
create index needs_family_idx on public.needs (family_id);

-- ---------------------------------------------------------------------------
-- Staff-only records
-- ---------------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  visited_on date not null default current_date,
  church_id uuid references public.churches (id) on delete set null,
  church_name text,
  interests text[] not null default '{}',
  stage text not null default 'Needs follow-up'
    check (stage in ('Needs follow-up', 'In sequence', 'Responded', 'Step taken')),
  touches integer not null default 0 check (touches >= 0),
  last_touch_at timestamptz,
  quote text,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  title text not null,
  about text,
  due_on date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  aplos_id text unique,
  donor_name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  given_on date not null,
  fund text not null default 'General',
  recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users (id) on delete set null default auth.uid(),
  church_id uuid references public.churches (id) on delete set null,
  text text not null
);

-- Hours are counted from completed care requests, never typed in.
create view public.volunteer_hours with (security_invoker = true) as
select v.id as volunteer_id,
       coalesce(sum(n.hours) filter (where n.status = 'Completed'), 0) as hours,
       max(n.needed_on) filter (where n.status = 'Completed') as last_served_on
from public.volunteers v
left join public.needs n on n.volunteer_id = v.id
group by v.id;

-- ---------------------------------------------------------------------------
-- Who is asking? These read the caller's profile without tripping its own policy.
-- ---------------------------------------------------------------------------
create function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create function public.my_church() returns uuid
language sql stable security definer set search_path = public as
$$ select church_id from public.profiles where id = auth.uid() $$;

create function public.is_team() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() in ('staff', 'coach'), false) $$;

revoke all on function public.my_role(), public.my_church(), public.is_team() from public;
grant execute on function public.my_role(), public.my_church(), public.is_team() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.coaches enable row level security;
alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.volunteers enable row level security;
alter table public.needs enable row level security;
alter table public.guests enable row level security;
alter table public.tasks enable row level security;
alter table public.gifts enable row level security;
alter table public.activity_log enable row level security;

-- Staff and coaches: everything.
create policy team_all on public.coaches for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.churches for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.families for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.volunteers for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.needs for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.guests for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.tasks for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.gifts for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.activity_log for all to authenticated using (public.is_team()) with check (public.is_team());

-- Profiles: you can read your own. Only staff can create or change them.
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());
create policy staff_profiles on public.profiles for all to authenticated
  using (public.my_role() = 'staff') with check (public.my_role() = 'staff');

-- Advocates: their own church and nothing else. No guests, gifts or coach to-dos.
create policy advocate_church_read on public.churches for select to authenticated
  using (public.my_role() = 'advocate' and id = public.my_church());

create policy advocate_families_read on public.families for select to authenticated
  using (public.my_role() = 'advocate' and church_id = public.my_church());
create policy advocate_families_update on public.families for update to authenticated
  using (public.my_role() = 'advocate' and church_id = public.my_church())
  with check (church_id = public.my_church());

create policy advocate_volunteers on public.volunteers for all to authenticated
  using (public.my_role() = 'advocate' and church_id = public.my_church())
  with check (public.my_role() = 'advocate' and church_id = public.my_church());

create policy advocate_needs on public.needs for all to authenticated
  using (public.my_role() = 'advocate' and church_id = public.my_church())
  with check (public.my_role() = 'advocate' and church_id = public.my_church());

create policy advocate_log_read on public.activity_log for select to authenticated
  using (public.my_role() = 'advocate' and church_id = public.my_church());
create policy advocate_log_write on public.activity_log for insert to authenticated
  with check (public.my_role() = 'advocate' and church_id = public.my_church());

-- People who are not signed in get nothing.
revoke all on all tables in schema public from anon;
