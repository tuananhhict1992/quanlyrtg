create table private.google_connections (
  id text primary key check (id = 'primary'),
  google_subject text not null,
  email text not null,
  encrypted_refresh_token text not null,
  root_id text,
  spreadsheet_id text,
  connected_by text not null,
  updated_at timestamptz not null default now()
);
alter table private.google_connections enable row level security;
revoke all on private.google_connections from public, anon, authenticated;
