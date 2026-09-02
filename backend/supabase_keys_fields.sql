-- Rayzer Stark Game — add client fields to access_keys (run ONCE)
alter table access_keys add column if not exists full_name text default '';
alter table access_keys add column if not exists email text default '';
alter table access_keys add column if not exists phone text default '';
