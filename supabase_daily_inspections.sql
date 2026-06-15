-- Daily IT inspections.
-- Run manually in the Supabase SQL Editor before using /inspections.

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

create table if not exists public.inspection_records (
  id uuid primary key default gen_random_uuid(),
  inspection_date date not null unique,
  inspector_name text not null,
  overall_status text not null default '正常',
  abnormal_count integer not null default 0,
  observation_count integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_record_items (
  id uuid primary key default gen_random_uuid(),
  inspection_record_id uuid not null references public.inspection_records(id) on delete cascade,
  category text not null,
  item_name text not null,
  status text not null default '正常',
  issue_description text not null default '',
  handling_status text not null default '未處理',
  handling_method text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_records_date_idx
  on public.inspection_records(inspection_date desc);

create index if not exists inspection_records_inspector_idx
  on public.inspection_records(inspector_name);

create index if not exists inspection_records_status_idx
  on public.inspection_records(overall_status);

create index if not exists inspection_record_items_record_idx
  on public.inspection_record_items(inspection_record_id);

drop trigger if exists inspection_records_set_updated_at on public.inspection_records;
create trigger inspection_records_set_updated_at
  before update on public.inspection_records
  for each row
  execute function public.set_updated_at();

drop trigger if exists inspection_record_items_set_updated_at on public.inspection_record_items;
create trigger inspection_record_items_set_updated_at
  before update on public.inspection_record_items
  for each row
  execute function public.set_updated_at();

alter table public.inspection_records enable row level security;
alter table public.inspection_record_items enable row level security;

grant select, insert, update, delete on public.inspection_records to service_role;
grant select, insert, update, delete on public.inspection_record_items to service_role;
