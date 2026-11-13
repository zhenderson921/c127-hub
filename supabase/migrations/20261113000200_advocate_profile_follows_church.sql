-- Removing a church used to fail when an advocate was attached to it, because the
-- advocate's church could not be blanked. Now the advocate's role is removed with the
-- church: their sign-in remains, but they see nothing until staff give them a role again.
alter table public.profiles drop constraint profiles_church_id_fkey;
alter table public.profiles add constraint profiles_church_id_fkey
  foreign key (church_id) references public.churches (id) on delete cascade;
