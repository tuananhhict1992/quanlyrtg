-- Operational data is private. Browser access is exclusively through authenticated Node APIs.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.records (
 module text not null, id text not null, data jsonb not null check(jsonb_typeof(data)='object'),
 owner_id text not null, checksum text not null, revision bigint not null default 1, updated_at timestamptz not null default now(),
 primary key(module,id), check(not(data ? 'password'))
);
create unique index employees_code_unique on private.records(lower(data->>'employeeCode')) where module='employees' and coalesce(data->>'employeeCode','')<>'';
create index records_owner_page on private.records(module,owner_id,id);
create index records_updated on private.records(module,updated_at);
create index records_payload on private.records using gin(data jsonb_path_ops);
create function private.record_revision() returns trigger language plpgsql set search_path='' as $$begin new.revision=old.revision+1;return new;end$$;
revoke all on function private.record_revision() from public,anon,authenticated;
create trigger record_revision before update on private.records for each row execute function private.record_revision();
create table private.accounts(auth_user_id uuid primary key references auth.users(id) on delete cascade,employee_id text not null unique);
create table private.audit_log(id bigint generated always as identity primary key,actor_id text not null,action text not null,module text,record_id text,detail jsonb not null default '{}',dedupe_key text unique,created_at timestamptz not null default now());
create index audit_log_time on private.audit_log(created_at desc,id desc);
create table private.sync_queue(
 job_id uuid primary key, sequence bigint generated always as identity unique,
 kind text not null check(kind in('drive','sheet')), module text not null,record_id text not null,
 checksum text not null, status text not null default 'pending' check(status in('pending','processing','success','failed')),
 payload jsonb not null,requested_by text not null,attempts integer not null default 0,
 last_error text,drive_file_id text,sheet_row bigint,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(kind,module,record_id,checksum)
);
create index sync_queue_claim on private.sync_queue(status,created_at,sequence);
create table private.sheet_counters(tab text primary key,next_row bigint not null check(next_row>=2));
create table private.temporary_files(job_id uuid primary key references private.sync_queue(job_id),bytes bytea not null check(octet_length(bytes)<=20971520),processed_at timestamptz,business_saved_at timestamptz,archived_at timestamptz,created_at timestamptz not null default now());
create table private.file_metadata(
 job_id uuid primary key references private.sync_queue(job_id),drive_file_id text not null unique check(length(drive_file_id)>0),
 drive_url text not null,file_name text not null,mime_type text not null,size bigint not null check(size>0),module text not null,record_id text not null,
 uploaded_at timestamptz not null default now(),uploaded_by text not null
);
create index file_metadata_record on private.file_metadata(module,record_id);
create table private.import_previews(job_id uuid primary key,actor_id text not null,module text not null,checksum text not null,rows jsonb not null,status text not null default 'pending' check(status in('pending','processing','success','failed')),expires_at timestamptz not null default now()+interval '30 minutes',created_at timestamptz not null default now(),unique(actor_id,module,checksum));
create table private.exam_attempts(id uuid primary key,quiz_id text not null,employee_id text not null,quiz jsonb not null,status text not null default 'processing' check(status in('processing','success','expired')),expires_at timestamptz not null,result jsonb);
create unique index exam_one_active_attempt on private.exam_attempts(quiz_id,employee_id) where status='processing';
create unique index ranking_period_unique on private.records((data->>'evaluationMonth'),(data->>'departmentName'),(data->>'groupName')) where module='bxxlRecords';
create unique index incident_source_unique on private.records((data->>'code'),(data->>'time')) where module='incidents' and coalesce(data->>'code','')<>'';
create table public.record_changes(id bigint generated always as identity primary key,module text not null,created_at timestamptz not null default now());
create index record_changes_time on public.record_changes(created_at);
alter table public.record_changes enable row level security;
grant select on public.record_changes to authenticated;
revoke all on public.record_changes from anon;
revoke insert,update,delete on public.record_changes from authenticated;
do $$ declare t text; begin
 foreach t in array array['records','accounts','audit_log','sync_queue','sheet_counters','temporary_files','file_metadata','import_previews','exam_attempts'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- A narrow, non-exposed helper permits only change notifications to active, provisioned users.
create function private.active_account() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.accounts a join private.records r on r.module='employees' and r.id=a.employee_id where a.auth_user_id=auth.uid() and r.data->>'status'='ACTIVE');
$$;
revoke all on function private.active_account() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.active_account() to authenticated;
create policy active_accounts_observe on public.record_changes for select to authenticated using((select private.active_account()));
create function private.claim_sync_job() returns setof private.sync_queue language sql security invoker set search_path='' as $$
 update private.sync_queue q set status='processing',attempts=attempts+1,updated_at=now()
 where job_id=(select j.job_id from private.sync_queue j where j.status='pending' and (j.kind='sheet' or exists(select 1 from private.temporary_files t where t.job_id=j.job_id and t.processed_at is not null and t.business_saved_at is not null)) order by j.sequence for update skip locked limit 1) returning q.*;
$$;
revoke all on function private.claim_sync_job() from public,anon,authenticated;
create function private.protect_audit() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Audit log is append only';end$$;
revoke all on function private.protect_audit() from public,anon,authenticated;
create trigger audit_append_only before update or delete on private.audit_log for each row execute function private.protect_audit();
create function private.protect_temporary_file() returns trigger language plpgsql set search_path='' as $$
 begin if old.processed_at is null or old.business_saved_at is null or old.archived_at is null or not exists(select 1 from private.file_metadata where job_id=old.job_id and length(drive_file_id)>0) then raise exception 'Cannot remove temporary file before confirmed archive';end if;return old;end$$;
revoke all on function private.protect_temporary_file() from public,anon,authenticated;
create trigger temporary_archive_required before delete on private.temporary_files for each row execute function private.protect_temporary_file();
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.record_changes;end if;end$$;
