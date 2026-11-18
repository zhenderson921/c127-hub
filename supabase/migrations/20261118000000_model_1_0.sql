-- C127 Hub: 1.0 data model. DRAFT FOR REVIEW. Not applied to the project yet.
--
-- Shaped by C127's own files (Family Spreadsheet, Church Spreadsheet, the
-- Experience visitor tracker, the Next Steps form) and the 2026-11-18 meeting.
-- 1.0 is: families, churches, the people attached to them, one contact log,
-- and Experience follow-up. Care Community teams, volunteers and care requests
-- stay as they are until 3.0.
--
-- Everything here ADDS to the first schema. No column the app reads today is
-- removed or renamed, so the current screens keep working. Columns this model
-- replaces are listed at the bottom; a later migration drops them once the
-- screens have moved over.
--
-- Naming: `coaches` is really "C127 staff" (coaches, family care, development).
-- It keeps its name for now so nothing breaks.

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
alter table public.coaches
  add column team text check (team in ('FAM', 'Family Care', 'Experience', 'Development', 'Leadership', 'Admin')),
  add column active boolean not null default true;

-- ---------------------------------------------------------------------------
-- Churches: the columns of the "Churches" tab
-- ---------------------------------------------------------------------------
-- `status` uses the nine statuses from the spreadsheet's "Key for Status" tab.
-- The old `stage` column stays until the Churches screen reads `status`.
alter table public.churches
  add column campus text,
  add column parent_church_id uuid references public.churches (id) on delete set null,
  add column status text not null default 'Potential Prospect'
    check (status in ('Potential Prospect', 'Active Prospect', 'Informed', 'Engaged', 'Equipped',
                      'On Hold', 'Needs Re-engagement', 'Closed', 'Not Interested')),
  add column street text,
  add column unit text,
  add column state text default 'FL',
  add column website text,
  add column social_handle text,
  add column denomination text,
  add column congregation_size integer check (congregation_size >= 0),
  add column fam_name text,
  add column fam_activities text[] not null default '{}',
  add column agreement_signed_on date,
  add column coach_priority text not null default 'Normal' check (coach_priority in ('Normal', 'Low')),
  add column next_step text,
  add column next_contact_on date,
  add column notes text,
  add column ps_external_id text unique;

comment on column public.churches.town is 'City. Named town in the first schema.';
comment on column public.churches.launched_on is 'FAM start date.';
comment on column public.churches.fam_activities is
  'What the FAM does, for example Care Communities - Foster, CarePortal, Serve Days. Free list so C127 can add activities.';

-- Other spellings of a church name, so imports and form answers land on the
-- right church ("Discovery Alafaya" with and without the dash).
create table public.church_aliases (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);
create unique index church_aliases_alias_idx on public.church_aliases (lower(alias));
create index church_aliases_church_idx on public.church_aliases (church_id);

-- ---------------------------------------------------------------------------
-- People: one row per adult, whatever they are to C127
-- ---------------------------------------------------------------------------
-- A foster mom who is also an advocate, a donor and an Experience guest is one
-- row here, with several roles. Children are NOT people rows; see `children`.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  street text,
  unit text,
  city text,
  state text default 'FL',
  zip text,
  county text,
  lat double precision,
  lng double precision,
  home_church_id uuid references public.churches (id) on delete set null,
  home_church_text text,
  owner_id uuid references public.coaches (id) on delete set null,
  birthday date,
  shirt_size text,
  email_opt_out boolean not null default false,
  notes text,
  source text not null default 'Hub',
  ps_external_id text unique,
  aplos_id text unique,
  hubspot_id text unique,
  created_at timestamptz not null default now()
);
-- Not unique: spouses often share one email address.
create index people_email_idx on public.people (lower(email));
create index people_name_idx on public.people (lower(last_name), lower(first_name));
create index people_home_church_idx on public.people (home_church_id);

comment on column public.people.home_church_text is
  'The church as the person typed it, kept when it has not been matched to a church row.';
comment on column public.people.owner_id is 'The staff member responsible for this relationship. Anyone on the team can still log a contact.';

-- Roles are the "tags" from the meeting. Reports filter on these.
-- church_id says where the role is held (advocate at, pastor of, volunteer with).
create table public.person_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  role text not null check (role in (
    'Advocate', 'Point Person', 'Pastor', 'Church Staff', 'Volunteer', 'Donor',
    'Child Welfare Professional', 'Business Leader', 'Corporate Partner',
    'Community Member', 'Board', 'C127 Staff', 'Other')),
  church_id uuid references public.churches (id) on delete cascade,
  title text,
  status text not null default 'Active' check (status in ('Active', 'On Hold', 'Inactive')),
  started_on date,
  ended_on date,
  created_at timestamptz not null default now(),
  unique nulls not distinct (person_id, role, church_id)
);
create index person_roles_church_idx on public.person_roles (church_id, role);
create index person_roles_role_idx on public.person_roles (role);

-- The advocate onboarding path from "Onboarding an Advocate": one row per
-- advocate, alongside their 'Advocate' role.
create table public.advocate_onboarding (
  person_id uuid primary key references public.people (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  step text not null default 'Pre-Clinic' check (step in ('Pre-Clinic', 'Post-Clinic', 'Active', 'On Hold', 'Inactive')),
  pre_clinic_call_on date,
  clinic_completed_on date,
  post_clinic_call_on date,
  fam_basics_completed_on date,
  myfam_training_on date,
  promoted boolean not null default false,
  next_contact_on date,
  details text,
  created_at timestamptz not null default now()
);
create index advocate_onboarding_church_idx on public.advocate_onboarding (church_id);

-- ---------------------------------------------------------------------------
-- Families (households): the columns of "Main Information"
-- ---------------------------------------------------------------------------
-- `church_id` is the SERVING church (it already drives what an advocate sees).
-- Home church is separate, because a family is often served by a church they
-- do not attend.
alter table public.families
  add column home_church_id uuid references public.churches (id) on delete set null,
  add column home_church_text text,
  add column owner_id uuid references public.coaches (id) on delete set null,
  add column street text,
  add column unit text,
  add column state text default 'FL',
  add column marital_status text check (marital_status in ('Married', 'Single', 'Separated', 'Divorced', 'Widowed', 'Unknown')),
  add column home_types text[] not null default '{}'
    check (home_types <@ array['Foster', 'Adoptive', 'Kinship', 'Non-relative', 'Pre-adoptive', 'Guardianship', 'Safe Families']),
  add column family_status text not null default 'Active'
    check (family_status in ('Licensing', 'Active', 'On Hold', 'Closed')),
  add column care_status text not null default 'Community & Prayer'
    check (care_status in ('Community & Prayer', 'Care Requested', 'Priority Care', 'No Care Community Wanted')),
  add column year_joined integer check (year_joined between 2000 and 2100),
  add column how_connected text,
  add column priority text,
  add column prayer_request text,
  add column welcome_email_sent_on date,
  add column welcome_bible_mailed_on date,
  add column fb_group text not null default 'No' check (fb_group in ('No', 'Requested', 'Admitted', 'Declined')),
  add column defender_dad boolean not null default false,
  add column tbri text,
  add column legacy_family boolean not null default false,
  add column open_to_story text check (open_to_story in ('Yes', 'Maybe', 'No')),
  add column next_contact_on date,
  add column removed_on date,
  add column removed_reason text,
  add column notes text,
  add column ps_external_id text unique;
create index families_home_church_idx on public.families (home_church_id);
create index families_owner_idx on public.families (owner_id);

comment on column public.families.town is 'City. Named town in the first schema.';
comment on column public.families.church_id is 'Serving church.';
comment on column public.families.family_status is
  'Where the family is with C127. Separate from care_status on purpose: Promise Serves kept them in one field and reports broke.';
comment on column public.families.care_status is
  'What the family wants from a Care Community. Whether one is building, active or finished comes from care_communities.';
comment on column public.families.removed_on is 'Replaces the yearly "Removed" tab. The family stays in the hub as history.';

-- The adults in a household.
create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  relationship text not null default 'Caregiver' check (relationship in ('Mom', 'Dad', 'Caregiver', 'Other adult')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (family_id, person_id)
);
create index family_members_person_idx on public.family_members (person_id);
-- One primary contact per family.
create unique index family_members_primary_idx on public.family_members (family_id) where is_primary;

-- Children: first name and year of birth, so the age band is worked out and
-- never typed. Replaces the PA/PB/PF... count columns. No last names.
create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  first_name text,
  birth_year integer check (birth_year between 1980 and 2100),
  relationship text not null default 'Unknown'
    check (relationship in ('Foster', 'Adopted', 'Biological', 'Kinship', 'Pre-adoptive', 'Guardianship', 'Unknown')),
  in_home boolean not null default true,
  arrived_on date,
  adopted_on date,
  left_on date,
  notes text,
  created_at timestamptz not null default now()
);
create index children_family_idx on public.children (family_id);

create view public.children_with_band with (security_invoker = true) as
select c.*,
       extract(year from current_date)::int - c.birth_year as age,
       case
         when c.birth_year is null then 'Unknown'
         when extract(year from current_date)::int - c.birth_year <= 4 then 'Preschool'
         when extract(year from current_date)::int - c.birth_year <= 10 then 'Elementary'
         when extract(year from current_date)::int - c.birth_year <= 13 then 'Middle'
         when extract(year from current_date)::int - c.birth_year <= 17 then 'Teen'
         else 'Adult'
       end as age_band
from public.children c;

-- A family's Care Communities over time. 1.0 keeps only what was asked for:
-- status, launch date, close date. Who is on the team stays in MyFam for now.
create table public.care_communities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  church_id uuid references public.churches (id) on delete set null,
  name text,
  status text not null default 'Building team' check (status in ('Building team', 'Active', 'Paused', 'Closed')),
  launched_on date,
  closed_on date,
  notes text,
  ps_external_id text unique,
  created_at timestamptz not null default now(),
  check (closed_on is null or launched_on is null or closed_on >= launched_on)
);
create index care_communities_family_idx on public.care_communities (family_id);
create index care_communities_church_idx on public.care_communities (church_id);

-- ---------------------------------------------------------------------------
-- One contact log
-- ---------------------------------------------------------------------------
-- Replaces the monthly contact columns, the Promise Serves note, the email to
-- the coach and the Slack post. One entry, visible from the family, the person
-- and the church.
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  logged_by uuid references auth.users (id) on delete set null default auth.uid(),
  staff_id uuid references public.coaches (id) on delete set null,
  method text not null check (method in ('Call', 'Voicemail', 'Text', 'Email', 'In person', 'Mail', 'Social', 'Event', 'Note')),
  reached boolean not null default true,
  summary text,
  family_id uuid references public.families (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  church_id uuid references public.churches (id) on delete cascade,
  follow_up_on date,
  source text not null default 'Hub',
  ps_external_id text unique,
  created_at timestamptz not null default now(),
  check (num_nonnulls(family_id, person_id, church_id) >= 1)
);
create index interactions_family_idx on public.interactions (family_id, at desc);
create index interactions_person_idx on public.interactions (person_id, at desc);
create index interactions_church_idx on public.interactions (church_id, at desc);

comment on column public.interactions.reached is 'False for a voicemail or an unanswered text, so "last real conversation" can be told apart from "last attempt".';

-- Last real contact, worked out from the log and never typed.
create view public.family_last_contact with (security_invoker = true) as
select f.id as family_id,
       max(i.at) filter (where i.reached) as last_reached_at,
       max(i.at) as last_attempt_at
from public.families f
left join public.interactions i on i.family_id = f.id
group by f.id;

-- ---------------------------------------------------------------------------
-- Center visits and the Experience
-- ---------------------------------------------------------------------------
-- The "VISITS" tab. A group that arrives without names is one row with a
-- party_size and no person; names are attached when the form comes in.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  visit_code text unique,
  visited_on date not null default current_date,
  person_id uuid references public.people (id) on delete set null,
  group_name text,
  party_size integer not null default 1 check (party_size >= 1),
  visit_type text not null default 'VCE'
    check (visit_type in ('VCE', 'Tour', 'Appointment', 'Training', 'Event', 'Drop-In', 'Volunteer', 'Community Gathering')),
  offerings text[] not null default '{}',
  engagement_source text,
  church_id uuid references public.churches (id) on delete set null,
  church_text text,
  host_id uuid references public.coaches (id) on delete set null,
  notes text,
  data_source text not null default 'Staff Entry'
    check (data_source in ('Historical Import', 'Front Desk Check-In', 'Event Registration', 'Staff Entry', 'Next Steps Form')),
  created_at timestamptz not null default now()
);
create index visits_person_idx on public.visits (person_id);
create index visits_date_idx on public.visits (visited_on);

-- The next steps a guest can tick on the form, and what C127 does about each.
-- This is the "Flow chart" tab as data, so C127 can change wording, owner or
-- action without a code change.
create table public.next_step_options (
  key text primary key,
  label text not null,
  track text not null check (track in ('Serve', 'Start a FAM', 'Give', 'Foster', 'Pray', 'Talk to someone', 'Already involved', 'No follow-up')),
  action text,
  route text not null default 'Shared queue' check (route in ('Shared queue', 'Church coach', 'Named owner', 'None')),
  owner_id uuid references public.coaches (id) on delete set null,
  cc text,
  sort integer not null default 0,
  active boolean not null default true
);

insert into public.next_step_options (key, label, track, action, route, sort) values
  ('meal',            'I might be able to bring a meal once a month to support a foster/adoptive family or helping with household work, etc', 'Serve', 'Care Community information', 'Church coach', 10),
  ('connect_weekly',  'I could connect weekly with a foster/adoptive parent and help schedule the weekly meals.', 'Serve', 'Advocate information', 'Church coach', 20),
  ('start_fam',       'I''d be interested in helping start or lead the ministry at my church.', 'Start a FAM', 'FAM team introduction', 'Church coach', 30),
  ('give',            'I''d like to give financially at c127.org/donate', 'Give', 'Thank-you call, then the giving link', 'Named owner', 40),
  ('foster',          'I''d like to learn more about fostering. Please send more information!', 'Foster', 'Foster information session', 'Named owner', 50),
  ('pray',            'I''d love to pray!', 'Pray', 'Add to the prayer email', 'Shared queue', 60),
  ('not_sure',        'Not sure - but put me in touch with someone who could tell me more!', 'Talk to someone', 'Phone call', 'Named owner', 70),
  ('already_fam',     'I''m already serving through my Family Advocacy Ministry in my church.', 'Already involved', 'Thank-you email', 'Shared queue', 80),
  ('already_family',  'I''m already a foster/adoptive family.', 'Already involved', 'Thank-you email', 'Shared queue', 90),
  ('already_either',  'I''m already a foster/adoptive family or I''m already serving through my church!', 'Already involved', 'Thank-you email', 'Shared queue', 100),
  ('already_career',  'I''m already engaged through my career in child welfare.', 'Already involved', 'Thank-you email', 'Shared queue', 110),
  ('not_now',         'This isn’t the right season for me to engage, but I’m grateful to have learned more.', 'No follow-up', null, 'None', 120);

-- One row per "My Next Steps" form answer, kept as the guest gave it.
create table public.vce_responses (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  person_id uuid references public.people (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  home_church_text text,
  church_id uuid references public.churches (id) on delete set null,
  wall_words text,
  feeling text,
  heard_from text,
  next_steps text[] not null default '{}',
  describes text[] not null default '{}',
  comments text,
  likely_to_invite integer check (likely_to_invite between 1 and 5),
  source text not null default 'Hub form' check (source in ('Google Form', 'HubSpot', 'Hub form')),
  external_id text unique,
  created_at timestamptz not null default now()
);
create index vce_responses_person_idx on public.vce_responses (person_id);
create index vce_responses_submitted_idx on public.vce_responses (submitted_at);

comment on column public.vce_responses.next_steps is 'Keys from next_step_options. A guest can tick several.';

-- ---------------------------------------------------------------------------
-- To-dos become the follow-up queue
-- ---------------------------------------------------------------------------
-- A to-do can now be about a family, church, person or form answer. With no
-- coach it sits in a shared queue (the Belong inbox) for whoever is in that day.
alter table public.tasks alter column coach_id drop not null;
alter table public.tasks
  add column kind text not null default 'General'
    check (kind in ('General', 'Experience follow-up', 'Family contact', 'Church touchpoint', 'Advocate contact')),
  add column queue text check (queue in ('Belong', 'FAM', 'Family Care', 'Development')),
  add column family_id uuid references public.families (id) on delete cascade,
  add column church_id uuid references public.churches (id) on delete cascade,
  add column person_id uuid references public.people (id) on delete cascade,
  add column response_id uuid references public.vce_responses (id) on delete cascade,
  add column next_step_key text references public.next_step_options (key) on delete set null,
  add column draft_subject text,
  add column draft_body text,
  add column done_at timestamptz,
  add column done_by uuid references auth.users (id) on delete set null,
  add column outcome text,
  add constraint tasks_owner_or_queue check (coach_id is not null or queue is not null);
create index tasks_queue_idx on public.tasks (queue) where not done;
create index tasks_response_idx on public.tasks (response_id);

comment on column public.tasks.draft_body is 'The email or text to copy and send. Sending from the hub comes later.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
-- Staff and coaches: everything. Advocates: nothing in the new tables yet.
-- They keep what they had (their church, its families, volunteers and care
-- requests). Children's names and the contact log are staff-only until C127
-- decides otherwise.
alter table public.church_aliases enable row level security;
alter table public.people enable row level security;
alter table public.person_roles enable row level security;
alter table public.advocate_onboarding enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.care_communities enable row level security;
alter table public.interactions enable row level security;
alter table public.visits enable row level security;
alter table public.next_step_options enable row level security;
alter table public.vce_responses enable row level security;

create policy team_all on public.church_aliases for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.people for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.person_roles for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.advocate_onboarding for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.family_members for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.children for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.care_communities for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.interactions for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.visits for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.next_step_options for all to authenticated using (public.is_team()) with check (public.is_team());
create policy team_all on public.vce_responses for all to authenticated using (public.is_team()) with check (public.is_team());

-- An advocate can see the Care Communities their own church runs.
create policy advocate_care_communities_read on public.care_communities for select to authenticated
  using (public.my_role() = 'advocate' and church_id = public.my_church());

-- People who are not signed in get nothing, including from the new tables and views.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Columns this model replaces (dropped in a later migration, once the screens
-- read the new ones):
--   churches.stage           -> churches.status
--   churches.advocate_name   -> person_roles (role 'Advocate') + advocate_onboarding
--   churches.last_contact_at -> interactions
--   families.type            -> families.home_types
--   families.status          -> families.family_status + care_status
--   families.care_community  -> care_communities
--   families.children        -> children
--   families.email, phone    -> people via family_members
--   families.last_contact_at -> family_last_contact
--   guests (whole table)     -> visits + vce_responses + tasks
--   gifts.donor_name         -> a person link, in 2.0 with the Aplos read
-- ---------------------------------------------------------------------------
