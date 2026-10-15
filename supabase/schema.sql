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

-- Register payments (plans, goods, personal training, debts, refunds) for the owner's reports.
create table if not exists sales (
  id text primary key,
  ts bigint not null,
  data jsonb not null
);
create index if not exists sales_ts on sales (ts);

-- One row per club entry, for attendance by day and hour.
create table if not exists visits (
  id bigint generated always as identity primary key,
  ts bigint not null,
  club text not null,
  member text not null,
  kind text not null default 'qr'
);
create index if not exists visits_ts on visits (ts);

alter table sales enable row level security;
alter table visits enable row level security;

-- Sessions each trainer worked, entered by hand by the administrators.
create table if not exists trainer_sessions (
  id text primary key,
  ts bigint not null,
  data jsonb not null
);
create index if not exists trainer_sessions_ts on trainer_sessions (ts);
alter table trainer_sessions enable row level security;

-- Network settings edited by the owner without a code change (the list of clubs).
create table if not exists settings (
  key text primary key,
  data jsonb not null
);
alter table settings enable row level security;
