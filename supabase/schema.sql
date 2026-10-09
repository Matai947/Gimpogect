-- Run once in Supabase → SQL Editor. Tables are private: RLS is on with no policies,
-- so only the server (secret key) can read or write them.
create table if not exists clients (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,
  ts bigint not null,
  data jsonb not null
);

alter table clients enable row level security;
alter table leads enable row level security;
