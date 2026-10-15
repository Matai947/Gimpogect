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

-- Trainer views and contact taps, for the staff chart.
create table if not exists clicks (
  id bigint generated always as identity primary key,
  ts bigint not null,
  kind text not null,
  target text not null,
  src text not null default 'app'
);
create index if not exists clicks_ts on clicks (ts);
alter table clicks enable row level security;
