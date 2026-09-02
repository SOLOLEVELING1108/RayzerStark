-- ============================================================
-- Rayzer Stark Game — BYPASS table (run ONCE in Supabase SQL Editor)
-- ============================================================
create table if not exists bypasses (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  title text not null,
  category text default 'Uncategorized',
  description text default '',
  cover_url text default '',
  file jsonb default '{}'::jsonb,          -- {filename, path, size}
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
