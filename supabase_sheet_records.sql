-- Generic storage for legacy Google Sheet tabs.
-- Run this once in Supabase SQL Editor before importing old Sheet data.

create extension if not exists pgcrypto;

create table if not exists public.sheet_records (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_label text not null default '',
  sheet_name text not null default '',
  record_key text not null,
  data jsonb not null default '{}'::jsonb,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, record_key)
);

create index if not exists sheet_records_source_key_idx
  on public.sheet_records (source_key, record_key);

create index if not exists sheet_records_search_text_idx
  on public.sheet_records using gin (to_tsvector('simple', search_text));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sheet_records_set_updated_at on public.sheet_records;
create trigger sheet_records_set_updated_at
before update on public.sheet_records
for each row execute function public.set_updated_at();

alter table public.sheet_records enable row level security;

grant select, insert, update, delete on table public.sheet_records to service_role;

drop policy if exists sheet_records_service_role_select on public.sheet_records;
create policy sheet_records_service_role_select
on public.sheet_records for select to service_role using (true);

drop policy if exists sheet_records_service_role_insert on public.sheet_records;
create policy sheet_records_service_role_insert
on public.sheet_records for insert to service_role with check (true);

drop policy if exists sheet_records_service_role_update on public.sheet_records;
create policy sheet_records_service_role_update
on public.sheet_records for update to service_role using (true) with check (true);

drop policy if exists sheet_records_service_role_delete on public.sheet_records;
create policy sheet_records_service_role_delete
on public.sheet_records for delete to service_role using (true);

notify pgrst, 'reload schema';
