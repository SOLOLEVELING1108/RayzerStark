-- Affiliate system: run this in the Supabase SQL editor.
create table if not exists public.affiliates (
  id text primary key,
  name text not null,
  key text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.access_keys add column if not exists affiliate_id text;
alter table public.access_keys add column if not exists affiliate_name text;
