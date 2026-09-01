-- ============================================================
-- Game Config Patcher — Supabase schema
-- Run this ONCE: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================
create extension if not exists "pgcrypto";

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  title text not null,
  category text default 'Uncategorized',
  description text default '',
  cover_url text default '',
  lua_files jsonb default '[]'::jsonb,
  in_store boolean default false,
  price numeric default 0,
  is_public boolean default false,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists dependencies (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  path text not null,
  size bigint default 0,
  is_deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  device_code text not null,
  game_id uuid not null,
  created_at timestamptz default now(),
  unique (device_code, game_id)
);

create table if not exists purchase_requests (
  id uuid primary key default gen_random_uuid(),
  device_code text not null,
  device_name text default '',
  game_id uuid not null,
  receipt_path text default '',
  status text default 'pending',           -- pending | approved | rejected
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists app_settings (
  id int primary key default 1,
  pix_key text default '',
  pix_type text default '',
  pix_holder text default ''
);
insert into app_settings (id, pix_key, pix_type, pix_holder)
values (1, '08624582504', 'CPF', 'Wdson de Jesus Souza')
on conflict (id) do nothing;

-- Tables have RLS disabled by default; the backend uses the service (secret) key.
