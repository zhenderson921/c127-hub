-- Feedback from inside the tool. Anyone on the team can send it from any page.
-- Only the person building the hub reads it, works through it and marks it done.

alter table public.profiles add column is_builder boolean not null default false;
comment on column public.profiles.is_builder is 'Sees the Feedback page: what the team has sent in and what is still outstanding.';

-- The first staff member in the hub is the one building it.
update public.profiles set is_builder = true
where id = (select id from public.profiles where role = 'staff' order by created_at limit 1);

create function public.is_builder() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_builder from public.profiles where id = auth.uid()), false) $$;

revoke all on function public.is_builder() from public, anon;
grant execute on function public.is_builder() to authenticated;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  author_name text,
  author_email text,
  kind text not null default 'Idea' check (kind in ('Idea', 'Something is wrong', 'Question')),
  message text not null check (btrim(message) <> ''),
  -- What they were looking at when they sent it.
  page_path text,
  page_label text,
  screen text,
  status text not null default 'New' check (status in ('New', 'In progress', 'Done', 'Not doing')),
  builder_note text,
  resolved_at timestamptz
);
create index feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;
-- Anyone on the team can send feedback, as themselves.
create policy team_send on public.feedback for insert to authenticated
  with check (public.is_team() and created_by = auth.uid());
-- Only the builder can read it or change it.
create policy builder_read on public.feedback for select to authenticated using (public.is_builder());
create policy builder_update on public.feedback for update to authenticated using (public.is_builder()) with check (public.is_builder());
create policy builder_delete on public.feedback for delete to authenticated using (public.is_builder());

revoke all on all tables in schema public from anon;
