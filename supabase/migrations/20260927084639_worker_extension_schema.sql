-- Preserve pg_net and its dependencies. Only the database scheduler may dispatch.
do $$ begin
 if exists(select 1 from pg_namespace where nspname='net') then
  revoke usage on schema net from public,anon,authenticated;
  revoke all on all tables in schema net from public,anon,authenticated;
  revoke execute on all functions in schema net from public,anon,authenticated;
 end if;
end $$;
