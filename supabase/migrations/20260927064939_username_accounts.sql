-- Unique case-insensitive usernames. Do not derive or store passwords in personnel data.
create unique index employees_username_unique on private.records(lower(btrim(data->>'username')))
where module='employees' and coalesce(btrim(data->>'username'),'')<>'';
-- Existing profiles without a username receive their own employee code when it is available and unique.
with updated as (
 update private.records r set data=jsonb_set(r.data,'{username}',to_jsonb(lower(btrim(r.data->>'employeeCode')))),
 checksum=md5(jsonb_set(r.data,'{username}',to_jsonb(lower(btrim(r.data->>'employeeCode'))))::text),updated_at=now()
 where r.module='employees' and coalesce(btrim(r.data->>'username'),'')=''
 and r.data->>'employeeCode' ~ '^[A-Za-z0-9._-]{2,64}$'
 and not exists(select 1 from private.records other where other.module='employees' and lower(btrim(other.data->>'username'))=lower(btrim(r.data->>'employeeCode')))
 returning id
)
insert into private.audit_log(actor_id,action,module,record_id)
select 'schema-migration','account.username.initialize','employees',id from updated;
alter table private.accounts add column must_change_password boolean not null default false;
alter table private.accounts add column credentials_changed_at timestamptz;
create table private.login_limits (
 key_hash text primary key, attempts integer not null, expires_at timestamptz not null
);
create index login_limits_expiry on private.login_limits(expires_at);
create table private.account_jobs (
 job_id uuid primary key, employee_id text not null, actor_id text not null,
 status text not null default 'pending' check(status in('pending','processing','success','failed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.login_limits enable row level security;
alter table private.account_jobs enable row level security;
revoke all on private.login_limits,private.account_jobs from public,anon,authenticated;
