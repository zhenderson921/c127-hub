-- One all-or-nothing load, used by scripts/preload.mjs to bring C127's
-- spreadsheets in. It takes rows for several tables in one call and inserts
-- them inside a single transaction: if any row is refused, nothing is written.
--
-- payload is { "<table>": [ { column: value, ... }, ... ], ... }. Tables are
-- loaded in the fixed order below so links between them hold. Every row for a
-- table must carry the same columns; columns that are left out get their
-- defaults. It runs as the caller, so row level security still applies, and it
-- refuses anyone who is not C127 staff or a coach.
create function public.import_records(payload jsonb) returns jsonb
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
                           'families', 'family_members', 'children', 'care_communities'] loop
    if jsonb_typeof(payload -> t) = 'array' and jsonb_array_length(payload -> t) > 0 then
      -- Only real columns of the table are used, so a stray key cannot reach the statement.
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

revoke all on function public.import_records(jsonb) from public, anon;
grant execute on function public.import_records(jsonb) to authenticated;
