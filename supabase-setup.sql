-- ================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

create table if not exists models (
  id           text primary key,
  name         text not null,
  price        numeric default 0,
  category     text not null,
  description  text default '',
  thumbnail    text default '',
  images       text[] default '{}',
  glb          text not null,
  created_at   timestamptz default now()
);

-- Allow your React frontend to read models (public read)
alter table models enable row level security;

create policy "Public read access"
  on models for select
  using (true);

-- Only server-side (service role) can insert/update/delete
-- No insert policy needed for anon — the API route uses service role key
