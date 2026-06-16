create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.sports_events (
  id uuid primary key default gen_random_uuid(),
  event_key text unique not null,
  title text not null,
  sport_type text not null,
  league text,
  home_team text,
  away_team text,
  start_time timestamptz not null,
  end_time timestamptz,
  venue text,
  status text not null default 'scheduled',
  importance text not null default 'normal',
  notes text,
  source_type text,
  source_name text,
  source_file text,
  source_month text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sports_favorites (
  id uuid primary key default gen_random_uuid(),
  favorite_type text not null,
  favorite_value text not null,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (favorite_type, favorite_value)
);

create table if not exists public.sports_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_month text,
  source_name text,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  status text not null default 'completed',
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.sports_event_details (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sports_events(id) on delete cascade,
  sport_type text not null,
  detail_status text not null default 'not_synced',
  sync_phase text,
  details jsonb not null default '{}'::jsonb,
  source_url text,
  source_name text,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id)
);

alter table public.sports_events
  add column if not exists event_key text,
  add column if not exists title text,
  add column if not exists sport_type text,
  add column if not exists league text,
  add column if not exists home_team text,
  add column if not exists away_team text,
  add column if not exists start_time timestamptz,
  add column if not exists end_time timestamptz,
  add column if not exists venue text,
  add column if not exists status text default 'scheduled',
  add column if not exists importance text default 'normal',
  add column if not exists notes text,
  add column if not exists source_type text,
  add column if not exists source_name text,
  add column if not exists source_file text,
  add column if not exists source_month text,
  add column if not exists raw_payload jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.sports_favorites
  add column if not exists favorite_type text,
  add column if not exists favorite_value text,
  add column if not exists display_name text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

alter table public.sports_import_batches
  add column if not exists source_file text,
  add column if not exists source_month text,
  add column if not exists source_name text,
  add column if not exists imported_count integer default 0,
  add column if not exists skipped_count integer default 0,
  add column if not exists status text default 'completed',
  add column if not exists message text,
  add column if not exists created_at timestamptz default now();

alter table public.sports_event_details
  add column if not exists event_id uuid,
  add column if not exists sport_type text,
  add column if not exists detail_status text default 'not_synced',
  add column if not exists sync_phase text,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists raw_payload jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists sports_events_event_key_uidx
  on public.sports_events (event_key);

create index if not exists sports_events_start_time_idx
  on public.sports_events (start_time);

create index if not exists sports_events_sport_type_idx
  on public.sports_events (sport_type);

create index if not exists sports_events_league_idx
  on public.sports_events (league);

create index if not exists sports_events_source_month_idx
  on public.sports_events (source_month);

create unique index if not exists sports_favorites_type_value_uidx
  on public.sports_favorites (favorite_type, favorite_value);

create index if not exists sports_import_batches_source_month_idx
  on public.sports_import_batches (source_month);

create unique index if not exists sports_event_details_event_id_uidx
  on public.sports_event_details (event_id);

create index if not exists sports_event_details_sport_type_idx
  on public.sports_event_details (sport_type);

create index if not exists sports_event_details_status_idx
  on public.sports_event_details (detail_status);

create index if not exists sports_event_details_last_synced_at_idx
  on public.sports_event_details (last_synced_at);

create index if not exists sports_event_details_details_gin_idx
  on public.sports_event_details using gin (details);

drop trigger if exists sports_events_set_updated_at on public.sports_events;
create trigger sports_events_set_updated_at
before update on public.sports_events
for each row execute function public.set_updated_at();

drop trigger if exists sports_event_details_set_updated_at on public.sports_event_details;
create trigger sports_event_details_set_updated_at
before update on public.sports_event_details
for each row execute function public.set_updated_at();

alter table public.sports_events enable row level security;
alter table public.sports_favorites enable row level security;
alter table public.sports_import_batches enable row level security;
alter table public.sports_event_details enable row level security;

grant select, insert, update, delete on table public.sports_events to service_role;
grant select, insert, update, delete on table public.sports_favorites to service_role;
grant select, insert, update, delete on table public.sports_import_batches to service_role;
grant select, insert, update, delete on table public.sports_event_details to service_role;

drop policy if exists sports_events_service_role_select on public.sports_events;
create policy sports_events_service_role_select
on public.sports_events for select to service_role using (true);

drop policy if exists sports_events_service_role_insert on public.sports_events;
create policy sports_events_service_role_insert
on public.sports_events for insert to service_role with check (true);

drop policy if exists sports_events_service_role_update on public.sports_events;
create policy sports_events_service_role_update
on public.sports_events for update to service_role using (true) with check (true);

drop policy if exists sports_events_service_role_delete on public.sports_events;
create policy sports_events_service_role_delete
on public.sports_events for delete to service_role using (true);

drop policy if exists sports_favorites_service_role_select on public.sports_favorites;
create policy sports_favorites_service_role_select
on public.sports_favorites for select to service_role using (true);

drop policy if exists sports_favorites_service_role_insert on public.sports_favorites;
create policy sports_favorites_service_role_insert
on public.sports_favorites for insert to service_role with check (true);

drop policy if exists sports_favorites_service_role_update on public.sports_favorites;
create policy sports_favorites_service_role_update
on public.sports_favorites for update to service_role using (true) with check (true);

drop policy if exists sports_favorites_service_role_delete on public.sports_favorites;
create policy sports_favorites_service_role_delete
on public.sports_favorites for delete to service_role using (true);

drop policy if exists sports_import_batches_service_role_select on public.sports_import_batches;
create policy sports_import_batches_service_role_select
on public.sports_import_batches for select to service_role using (true);

drop policy if exists sports_import_batches_service_role_insert on public.sports_import_batches;
create policy sports_import_batches_service_role_insert
on public.sports_import_batches for insert to service_role with check (true);

drop policy if exists sports_import_batches_service_role_update on public.sports_import_batches;
create policy sports_import_batches_service_role_update
on public.sports_import_batches for update to service_role using (true) with check (true);

drop policy if exists sports_import_batches_service_role_delete on public.sports_import_batches;
create policy sports_import_batches_service_role_delete
on public.sports_import_batches for delete to service_role using (true);

drop policy if exists sports_event_details_service_role_select on public.sports_event_details;
create policy sports_event_details_service_role_select
on public.sports_event_details for select to service_role using (true);

drop policy if exists sports_event_details_service_role_insert on public.sports_event_details;
create policy sports_event_details_service_role_insert
on public.sports_event_details for insert to service_role with check (true);

drop policy if exists sports_event_details_service_role_update on public.sports_event_details;
create policy sports_event_details_service_role_update
on public.sports_event_details for update to service_role using (true) with check (true);

drop policy if exists sports_event_details_service_role_delete on public.sports_event_details;
create policy sports_event_details_service_role_delete
on public.sports_event_details for delete to service_role using (true);

/*
Verification SQL after applying this file:

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('sports_events', 'sports_favorites', 'sports_import_batches', 'sports_event_details')
order by table_name;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('sports_events', 'sports_favorites', 'sports_import_batches', 'sports_event_details')
order by tablename, indexname;

select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('sports_events', 'sports_event_details')
order by event_object_table, trigger_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('sports_events', 'sports_favorites', 'sports_import_batches', 'sports_event_details')
order by c.relname;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('sports_events', 'sports_favorites', 'sports_import_batches', 'sports_event_details')
order by tablename, policyname;
*/
