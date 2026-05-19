-- AItem Scout — Initial schema
-- Tables: profiles, projects, saved_items, source_citations, search_caches, search_logs

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_platform') then
    create type source_platform as enum (
      'naver','kakao','youtube','instagram','x','threads','google_trends','web'
    );
  end if;
end $$;

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  workspace_name text not null default 'My Workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- projects ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  share_token text unique,
  share_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_share_token_idx on public.projects (share_token) where share_token is not null;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ---------- saved_items ----------
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  summary text,
  thumbnail_url text,
  source_url text not null,
  source_platform source_platform not null default 'web',
  recommendation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists saved_items_project_position_idx
  on public.saved_items (project_id, position);

-- ---------- source_citations ----------
create table if not exists public.source_citations (
  id uuid primary key default gen_random_uuid(),
  saved_item_id uuid not null references public.saved_items(id) on delete cascade,
  platform source_platform not null,
  url text not null,
  excerpt text
);

create index if not exists source_citations_item_idx on public.source_citations (saved_item_id);

-- ---------- search_caches ----------
create table if not exists public.search_caches (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists search_caches_expires_idx
  on public.search_caches (expires_at);

-- ---------- search_logs ----------
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  connectors_used text[] not null default '{}',
  connectors_failed text[] not null default '{}',
  cache_hit boolean not null default false,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists search_logs_user_created_idx
  on public.search_logs (user_id, created_at desc);
