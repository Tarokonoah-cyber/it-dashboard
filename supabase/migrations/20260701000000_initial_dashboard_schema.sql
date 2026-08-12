-- Baseline schema for clean/local deployments.
-- This migration intentionally contains schema only: no production data and no seeds.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create sequence if not exists public.work_logs_seq start 1;
create sequence if not exists public.todo_logs_seq start 1;
create sequence if not exists public.follow_ups_seq start 1;
create sequence if not exists public.calendar_events_seq start 1;

create table if not exists public.work_logs (
  id text primary key default ('WL-' || lpad(nextval('public.work_logs_seq')::text, 4, '0')),
  date date not null default current_date,
  staff text not null default 'Admin',
  title text not null,
  category text not null default 'general',
  impact text not null default 'normal',
  status text not null default 'pending',
  description text not null default '',
  note text not null default '',
  source text not null default 'vercel-dashboard',
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists work_logs_source_source_id_uidx
  on public.work_logs (source, source_id)
  where source_id is not null;
create index if not exists work_logs_date_idx
  on public.work_logs (date desc, updated_at desc);

create table if not exists public.todo_logs (
  id text primary key default ('TD-' || lpad(nextval('public.todo_logs_seq')::text, 4, '0')),
  title text not null,
  description text not null default '',
  status text not null default 'pending',
  priority text not null default 'normal',
  owner text not null default 'Admin',
  due_date date,
  source text not null default 'vercel-dashboard',
  note text not null default '',
  sort_order integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todo_logs_sort_order_idx
  on public.todo_logs (sort_order asc nulls last, created_at desc);

create table if not exists public.quick_notes (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quick_notes_sort_order_idx
  on public.quick_notes (sort_order, created_at desc);

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

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  record_key text,
  department text,
  title_zh text,
  title_en text,
  name_zh text,
  name_en text,
  extension text,
  office_phone text,
  cht_mobile text,
  mobile_phone text,
  email text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submitted_documents (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  record_key text,
  doc_date text,
  doc_month text,
  document_type text,
  cost_center text,
  vendor text,
  description text,
  total_amount text,
  note text,
  source_updated_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anydesk_devices (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  record_key text,
  device_name text,
  anydesk_id text,
  anydesk_password text,
  note text,
  last_checked_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id text primary key,
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  contract_name text,
  vendor text,
  start_date text,
  end_date text,
  amount numeric,
  owner text,
  status text,
  file_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_contracts (
  id text primary key,
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  phone_no text,
  user_name text,
  department text,
  carrier text,
  plan_name text,
  start_date text,
  end_date text,
  amount numeric,
  owner text,
  status text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  source_key text,
  source_label text,
  record_key text,
  asset_type text,
  asset_name text,
  department text,
  user_name text,
  ip_address text,
  mac_address text,
  model text,
  windows_version text,
  antivirus_installed text,
  status text,
  inventory_staff text,
  inventory_time text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sop_documents (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid unique references public.sheet_records(id) on delete cascade,
  sop_id text unique,
  sop_name text,
  category text,
  system_name text,
  department text,
  version text,
  status text,
  owner text,
  keywords text,
  drive_url text,
  note text,
  title text,
  description text,
  file_path text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sop_documents_category_file_path_key
  on public.sop_documents(category, file_path);
create index if not exists contacts_department_idx on public.contacts(department);
create index if not exists submitted_documents_month_idx on public.submitted_documents(doc_month);
create index if not exists assets_source_key_idx on public.assets(source_key);
create index if not exists assets_department_idx on public.assets(department);
create index if not exists contracts_end_date_idx on public.contracts(end_date);
create index if not exists mobile_contracts_end_date_idx on public.mobile_contracts(end_date);
create index if not exists sop_documents_category_idx on public.sop_documents(category);

create table if not exists public.network_test_rooms (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  room_no text not null,
  source text not null default 'line',
  raw_message text not null default '',
  status text not null default 'pending',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_no)
);

create table if not exists public.line_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null default '',
  source_type text not null default '',
  source_id text not null default '',
  raw_message text not null default '',
  parsed_rooms jsonb not null default '[]'::jsonb,
  result text not null default '',
  note text not null default ''
);

create index if not exists network_test_rooms_date_idx
  on public.network_test_rooms (date desc, room_no);
create index if not exists line_webhook_logs_created_at_idx
  on public.line_webhook_logs (created_at desc);

create table if not exists public.follow_ups (
  id text primary key default ('FU-' || lpad(nextval('public.follow_ups_seq')::text, 4, '0')),
  title text not null,
  current_status text not null default '等待回覆',
  next_follow_date date not null,
  note text,
  assignee text not null default 'Admin',
  source_todo_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint follow_ups_status_check
    check (current_status in ('等待回覆', '處理中', '待確認', '已完成'))
);

create index if not exists follow_ups_next_follow_date_idx
  on public.follow_ups (next_follow_date);
create index if not exists follow_ups_current_status_idx
  on public.follow_ups (current_status);
create index if not exists follow_ups_source_todo_id_idx
  on public.follow_ups (source_todo_id);

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
create index if not exists inspection_record_items_record_idx
  on public.inspection_record_items(inspection_record_id);

create table if not exists public.calendar_events (
  id text primary key default ('CE-' || lpad(nextval('public.calendar_events_seq')::text, 4, '0')),
  event_date date not null,
  event_time time,
  title text not null,
  event_type text not null default '任務',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_event_date_idx
  on public.calendar_events (event_date, event_time nulls first, created_at);

create table if not exists public.password_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null default '',
  system_name text not null default '',
  login_url text not null default '',
  username text not null default '',
  password_item text not null default '',
  notes text not null default '',
  bitwarden_item_name text not null default '',
  bitwarden_item_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, system_name, login_url, username)
);

comment on table public.password_entries is
  'Dashboard password index metadata only. Real passwords and secrets belong in the approved vault.';
comment on column public.password_entries.password_item is
  'Vault item label or reference only. Never store an actual password here.';

create index if not exists password_entries_category_system_idx
  on public.password_entries (category, system_name);

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
  event_id uuid not null unique references public.sports_events(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);

create index if not exists sports_events_start_time_idx on public.sports_events(start_time);
create index if not exists sports_events_sport_type_idx on public.sports_events(sport_type);
create index if not exists sports_events_league_idx on public.sports_events(league);
create index if not exists sports_events_source_month_idx on public.sports_events(source_month);
create index if not exists sports_event_details_status_idx on public.sports_event_details(detail_status);
create index if not exists sports_event_details_last_synced_at_idx on public.sports_event_details(last_synced_at);
create index if not exists sports_event_details_details_gin_idx on public.sports_event_details using gin(details);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'work_logs', 'todo_logs', 'quick_notes', 'sheet_records', 'contacts',
    'submitted_documents', 'anydesk_devices', 'contracts', 'mobile_contracts',
    'assets', 'sop_documents', 'network_test_rooms', 'line_webhook_logs',
    'follow_ups', 'inspection_records', 'inspection_record_items',
    'calendar_events', 'password_entries', 'sports_events', 'sports_favorites',
    'sports_import_batches', 'sports_event_details'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end
$$;

grant usage, select on sequence public.work_logs_seq to service_role;
grant usage, select on sequence public.todo_logs_seq to service_role;
grant usage, select on sequence public.follow_ups_seq to service_role;
grant usage, select on sequence public.calendar_events_seq to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'work_logs', 'todo_logs', 'quick_notes', 'sheet_records', 'contacts',
    'submitted_documents', 'anydesk_devices', 'contracts', 'mobile_contracts',
    'assets', 'network_test_rooms', 'follow_ups', 'inspection_records',
    'inspection_record_items', 'calendar_events', 'password_entries',
    'sports_events', 'sports_favorites', 'sports_import_batches',
    'sports_event_details'
  ]
  loop
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

drop trigger if exists work_logs_set_updated_at on public.work_logs;
create trigger work_logs_set_updated_at before update on public.work_logs
for each row execute function public.set_updated_at();
drop trigger if exists todo_logs_set_updated_at on public.todo_logs;
create trigger todo_logs_set_updated_at before update on public.todo_logs
for each row execute function public.set_updated_at();
drop trigger if exists quick_notes_set_updated_at on public.quick_notes;
create trigger quick_notes_set_updated_at before update on public.quick_notes
for each row execute function public.set_updated_at();
drop trigger if exists sheet_records_set_updated_at on public.sheet_records;
create trigger sheet_records_set_updated_at before update on public.sheet_records
for each row execute function public.set_updated_at();
drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts
for each row execute function public.set_updated_at();
drop trigger if exists mobile_contracts_set_updated_at on public.mobile_contracts;
create trigger mobile_contracts_set_updated_at before update on public.mobile_contracts
for each row execute function public.set_updated_at();
drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets
for each row execute function public.set_updated_at();
drop trigger if exists network_test_rooms_set_updated_at on public.network_test_rooms;
create trigger network_test_rooms_set_updated_at before update on public.network_test_rooms
for each row execute function public.set_updated_at();
drop trigger if exists inspection_records_set_updated_at on public.inspection_records;
create trigger inspection_records_set_updated_at before update on public.inspection_records
for each row execute function public.set_updated_at();
drop trigger if exists inspection_record_items_set_updated_at on public.inspection_record_items;
create trigger inspection_record_items_set_updated_at before update on public.inspection_record_items
for each row execute function public.set_updated_at();
drop trigger if exists password_entries_set_updated_at on public.password_entries;
create trigger password_entries_set_updated_at before update on public.password_entries
for each row execute function public.set_updated_at();
drop trigger if exists sports_events_set_updated_at on public.sports_events;
create trigger sports_events_set_updated_at before update on public.sports_events
for each row execute function public.set_updated_at();
drop trigger if exists sports_event_details_set_updated_at on public.sports_event_details;
create trigger sports_event_details_set_updated_at before update on public.sports_event_details
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-files',
  'sop-files',
  true,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant select on public.sop_documents to anon, authenticated;
drop policy if exists "Allow public read access to SOP documents" on public.sop_documents;
create policy "Allow public read access to SOP documents"
  on public.sop_documents for select to anon, authenticated using (true);

drop policy if exists "Allow public read access to SOP files" on storage.objects;
create policy "Allow public read access to SOP files"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'sop-files');

drop policy if exists "Allow service role to manage SOP files" on storage.objects;
create policy "Allow service role to manage SOP files"
  on storage.objects for all to service_role
  using (bucket_id = 'sop-files')
  with check (bucket_id = 'sop-files');

notify pgrst, 'reload schema';
