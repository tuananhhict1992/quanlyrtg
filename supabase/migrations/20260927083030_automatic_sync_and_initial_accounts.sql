-- Only the trusted Node worker / database scheduler may access these tables.
alter table private.sync_queue add column retry_count integer not null default 0,
 add column next_attempt_at timestamptz;
create index sync_queue_unfinished on private.sync_queue(sequence desc) where status <> 'success';
create table private.worker_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 endpoint text not null check(endpoint in (
  'https://quanlyrtg-290449474780.asia-southeast1.run.app/api/internal/worker',
  'https://quanlyrtg.ai.studio/api/internal/worker'))
);
insert into private.worker_config(endpoint) values('https://quanlyrtg-290449474780.asia-southeast1.run.app/api/internal/worker');
create table private.worker_dispatches (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 claimed_at timestamptz, finished_at timestamptz, processed integer not null default 0,
 status text not null default 'pending' check(status in ('pending','processing','success','failed')),
 request_id bigint
);
create index worker_dispatches_recent on private.worker_dispatches(created_at desc);
create table private.initial_account_queue (
 job_id uuid primary key default gen_random_uuid(), employee_id text not null unique,
 actor_id text not null, status text not null default 'pending' check(status in ('pending','processing','success','failed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 last_error text
);
alter table private.worker_config enable row level security;
alter table private.worker_dispatches enable row level security;
alter table private.initial_account_queue enable row level security;
revoke all on private.worker_config,private.worker_dispatches,private.initial_account_queue from public,anon,authenticated;

create or replace function private.claim_sync_job() returns setof private.sync_queue language sql set search_path='' as $$
 update private.sync_queue q set status='processing',attempts=attempts+1,updated_at=now(),
 retry_count=retry_count+case when status='failed' then 1 else 0 end,next_attempt_at=null
 where job_id=(select j.job_id from private.sync_queue j
 where (j.status='pending' or (j.status='failed' and j.retry_count<3 and j.next_attempt_at<=now()))
 and (j.kind='sheet' or exists(select 1 from private.temporary_files t where t.job_id=j.job_id and t.processed_at is not null and t.business_saved_at is not null))
 order by j.sequence for update skip locked limit 1) returning q.*;
$$;
revoke all on function private.claim_sync_job() from public,anon,authenticated;

-- Each wake-up has a random, single-use credential. The API stores only its hash.
-- This invoker function is called by pg_cron as postgres, never via a browser RPC.
create function private.dispatch_worker() returns void language plpgsql set search_path='' as $$
declare target text; token text; dispatch_id uuid; http_id bigint;
begin
 if not pg_try_advisory_xact_lock(726449) then return; end if;
 select endpoint into target from private.worker_config where singleton and enabled;
 if target is null then return; end if;
 update private.worker_dispatches set status='failed',finished_at=now()
  where status in ('pending','processing') and expires_at<now();
 if exists(select 1 from private.worker_dispatches where status in ('pending','processing')) then return; end if;
 if not exists(select 1 from private.initial_account_queue where status in ('pending','processing'))
 and not exists(select 1 from private.sync_queue where status in ('pending','processing')
  or (status='failed' and retry_count<3 and next_attempt_at<=now())) then return; end if;
 token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 insert into private.worker_dispatches(token_hash,expires_at)
 values(encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '5 minutes') returning id into dispatch_id;
 select net.http_post(url:=target,body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
  timeout_milliseconds:=120000) into http_id;
 update private.worker_dispatches set request_id=http_id where id=dispatch_id;
 delete from private.worker_dispatches where created_at<now()-interval '7 days' and finished_at is not null;
end $$;
revoke all on function private.dispatch_worker() from public,anon,authenticated;

-- These managed extensions are absent in local PGlite; core schema/tests still run there.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron')
 and exists(select 1 from pg_available_extensions where name='pg_net') then
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule('rtg-automatic-worker','* * * * *','select private.dispatch_worker()');
 end if;
end $$;
