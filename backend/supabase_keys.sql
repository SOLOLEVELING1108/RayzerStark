-- ============================================================
-- Rayzer Stark Game — ACCESS KEYS (run ONCE in Supabase SQL Editor)
-- ============================================================
create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  hwid text,                       -- bound to the first PC that activates it
  label text default '',
  status text default 'active',    -- active | revoked
  created_at timestamptz default now(),
  activated_at timestamptz
);
