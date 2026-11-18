-- A follow-up moves through stages, so it can be shown as a pipeline.
-- C127's trouble was that the first message went out and nothing after it:
-- "Reached out" and "Responded" keep a guest in view until they take a step.
alter table public.tasks
  add column stage text not null default 'To do'
    check (stage in ('To do', 'Reached out', 'Responded', 'Step taken', 'Not needed'));

update public.tasks set stage = 'Step taken' where done;

-- `done` follows the stage, so older screens that read it stay right.
create function public.task_stage_sets_done() returns trigger
language plpgsql set search_path = public as $$
begin
  new.done := new.stage in ('Step taken', 'Not needed');
  if new.done and new.done_at is null then
    new.done_at := now();
    new.done_by := coalesce(new.done_by, auth.uid());
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end $$;

create trigger task_stage_sets_done before insert or update of stage on public.tasks
  for each row execute function public.task_stage_sets_done();
