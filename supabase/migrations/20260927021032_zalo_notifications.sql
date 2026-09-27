-- Only the authenticated Node backend can access this outbox; never expose OA tokens.
create table private.zalo_targets (
  kind text not null check (kind in ('user','group')),
  local_key text not null,
  oa_id text not null,
  zalo_id text not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key(kind,local_key),
  unique(oa_id,kind,zalo_id)
);
create table private.zalo_notifications (
  job_id uuid primary key,
  checksum text not null,
  requested_by text not null,
  source_module text,
  source_record_id text,
  recipient_type text not null check(recipient_type in ('INDIVIDUAL','DEPARTMENT','ALL')),
  department text,
  title text not null,
  content text not null,
  send_at timestamptz not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check((source_module is null) = (source_record_id is null)),
  unique(requested_by,checksum)
);
create table private.zalo_deliveries (
  id bigint generated always as identity primary key,
  job_id uuid not null references private.zalo_notifications(job_id),
  target_kind text not null check(target_kind in ('user','group')),
  local_key text not null,
  recipient_ids jsonb not null check(jsonb_typeof(recipient_ids)='array'),
  recipient_label text not null,
  oa_id text not null,
  target_id text not null,
  status text not null default 'pending' check(status in ('pending','processing','success','failed','unknown','cancelled')),
  attempts integer not null default 0,
  provider_message_id text,
  error_code text,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(job_id,target_kind,local_key),
  unique(job_id,target_kind,target_id)
);
create index zalo_notifications_sender_created on private.zalo_notifications(requested_by,created_at desc);
create index zalo_deliveries_pending on private.zalo_deliveries(status,id) where status in ('pending','processing');
alter table private.zalo_targets enable row level security;
alter table private.zalo_notifications enable row level security;
alter table private.zalo_deliveries enable row level security;
revoke all on private.zalo_targets,private.zalo_notifications,private.zalo_deliveries from public,anon,authenticated;
revoke all on sequence private.zalo_deliveries_id_seq from public,anon,authenticated;
