-- Imports can change hundreds of records. Subscribers need one invalidation per
-- module after commit, not one event for every row. No business data is discarded.
create function private.coalesce_record_changes() returns trigger
language plpgsql set search_path='' as $$
declare seen text[] := string_to_array(coalesce(current_setting('rtg.changed_modules',true),''),',');
begin
  if new.module = any(seen) then return null; end if;
  perform set_config('rtg.changed_modules',array_to_string(array_append(seen,new.module),','),true);
  return new;
end;
$$;
revoke all on function private.coalesce_record_changes() from public,anon,authenticated;
create trigger coalesce_record_changes before insert on public.record_changes
for each row execute function private.coalesce_record_changes();
