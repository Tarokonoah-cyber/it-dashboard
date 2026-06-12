-- Normalize imported Sheet records into real Supabase tables.
-- Run this once in Supabase SQL Editor after sheet_records has been imported.
-- sheet_records remains as the raw backup/staging table.

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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contacts_department_idx on public.contacts(department);
create index if not exists submitted_documents_month_idx on public.submitted_documents(doc_month);
create index if not exists assets_source_key_idx on public.assets(source_key);
create index if not exists assets_department_idx on public.assets(department);
create index if not exists contracts_end_date_idx on public.contracts(end_date);
create index if not exists mobile_contracts_end_date_idx on public.mobile_contracts(end_date);
create index if not exists sop_documents_category_idx on public.sop_documents(category);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();

drop trigger if exists submitted_documents_set_updated_at on public.submitted_documents;
create trigger submitted_documents_set_updated_at before update on public.submitted_documents for each row execute function public.set_updated_at();

drop trigger if exists anydesk_devices_set_updated_at on public.anydesk_devices;
create trigger anydesk_devices_set_updated_at before update on public.anydesk_devices for each row execute function public.set_updated_at();

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts for each row execute function public.set_updated_at();

drop trigger if exists mobile_contracts_set_updated_at on public.mobile_contracts;
create trigger mobile_contracts_set_updated_at before update on public.mobile_contracts for each row execute function public.set_updated_at();

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();

drop trigger if exists sop_documents_set_updated_at on public.sop_documents;
create trigger sop_documents_set_updated_at before update on public.sop_documents for each row execute function public.set_updated_at();

insert into public.contacts (
  source_record_id, record_key, department, title_zh, title_en, name_zh, name_en,
  extension, office_phone, cht_mobile, mobile_phone, email, note, updated_at
)
select
  id,
  record_key,
  data ->> '單位',
  data ->> '職稱',
  data ->> 'Position',
  data ->> '姓名',
  data ->> 'Name',
  data ->> '分機 Extension',
  data ->> '辦公室專線 Office',
  data ->> '中華電信 *55',
  data ->> '個人行動電話',
  data ->> 'E-mail address',
  data ->> '備註',
  now()
from public.sheet_records
where source_key = 'contacts'
on conflict (source_record_id) do update set
  record_key = excluded.record_key,
  department = excluded.department,
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  extension = excluded.extension,
  office_phone = excluded.office_phone,
  cht_mobile = excluded.cht_mobile,
  mobile_phone = excluded.mobile_phone,
  email = excluded.email,
  note = excluded.note;

insert into public.submitted_documents (
  source_record_id, record_key, doc_date, doc_month, document_type, cost_center,
  vendor, description, total_amount, note, source_updated_at, updated_at
)
select
  id,
  record_key,
  data ->> '日期',
  data ->> '月份',
  data ->> '單據格式',
  data ->> '成本歸屬',
  data ->> '供應商',
  data ->> '項目說明',
  data ->> '總金額',
  data ->> '備註',
  data ->> '最後更新時間',
  now()
from public.sheet_records
where source_key = 'documents'
on conflict (source_record_id) do update set
  record_key = excluded.record_key,
  doc_date = excluded.doc_date,
  doc_month = excluded.doc_month,
  document_type = excluded.document_type,
  cost_center = excluded.cost_center,
  vendor = excluded.vendor,
  description = excluded.description,
  total_amount = excluded.total_amount,
  note = excluded.note,
  source_updated_at = excluded.source_updated_at;

insert into public.anydesk_devices (
  source_record_id, record_key, device_name, anydesk_id, anydesk_password,
  note, last_checked_at, updated_at
)
select
  id,
  record_key,
  data ->> '設備名稱',
  data ->> 'AnyDesk ID',
  data ->> '密碼',
  data ->> '備註',
  data ->> '最後確認時間',
  now()
from public.sheet_records
where source_key = 'anydesk'
on conflict (source_record_id) do update set
  record_key = excluded.record_key,
  device_name = excluded.device_name,
  anydesk_id = excluded.anydesk_id,
  anydesk_password = excluded.anydesk_password,
  note = excluded.note,
  last_checked_at = excluded.last_checked_at;

insert into public.contracts (
  id, source_record_id, contract_name, vendor, start_date, end_date, amount,
  owner, status, file_url, note, updated_at
)
select
  coalesce(nullif(data ->> 'id', ''), record_key),
  id,
  data ->> 'contract_name',
  data ->> 'vendor',
  data ->> 'start_date',
  data ->> 'end_date',
  nullif(regexp_replace(coalesce(data ->> 'amount', ''), '[^0-9.-]', '', 'g'), '')::numeric,
  data ->> 'owner',
  data ->> 'status',
  data ->> 'file_url',
  data ->> 'note',
  now()
from public.sheet_records
where source_key = 'contracts'
on conflict (id) do update set
  source_record_id = excluded.source_record_id,
  contract_name = excluded.contract_name,
  vendor = excluded.vendor,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  amount = excluded.amount,
  owner = excluded.owner,
  status = excluded.status,
  file_url = excluded.file_url,
  note = excluded.note;

insert into public.mobile_contracts (
  id, source_record_id, phone_no, user_name, department, carrier, plan_name,
  start_date, end_date, amount, owner, status, note, updated_at
)
select
  coalesce(nullif(data ->> 'id', ''), record_key),
  id,
  coalesce(data ->> 'phone_no', data ->> 'phone', data ->> 'mobile_no', data ->> '門號'),
  coalesce(data ->> 'user', data ->> '使用者'),
  coalesce(data ->> 'department', data ->> '部門'),
  coalesce(data ->> 'carrier', data ->> 'vendor', data ->> '電信商'),
  coalesce(data ->> 'plan', data ->> '方案'),
  data ->> 'start_date',
  coalesce(data ->> 'end_date', data ->> 'expire_date', data ->> '到期日'),
  nullif(regexp_replace(coalesce(data ->> 'amount', ''), '[^0-9.-]', '', 'g'), '')::numeric,
  data ->> 'owner',
  data ->> 'status',
  coalesce(data ->> 'note', data ->> '備註'),
  now()
from public.sheet_records
where source_key = 'mobile_contracts'
on conflict (id) do update set
  source_record_id = excluded.source_record_id,
  phone_no = excluded.phone_no,
  user_name = excluded.user_name,
  department = excluded.department,
  carrier = excluded.carrier,
  plan_name = excluded.plan_name,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  amount = excluded.amount,
  owner = excluded.owner,
  status = excluded.status,
  note = excluded.note;

insert into public.assets (
  source_record_id, source_key, source_label, record_key, asset_type, asset_name,
  department, user_name, ip_address, mac_address, model, windows_version,
  antivirus_installed, status, inventory_staff, inventory_time, note, updated_at
)
select
  id,
  source_key,
  source_label,
  record_key,
  coalesce(data ->> '資產類型', source_label),
  coalesce(data ->> '設備名稱', data ->> '電腦名稱'),
  data ->> '部門',
  data ->> '使用人',
  data ->> 'IP位置',
  coalesce(data ->> 'MAC位置', data ->> 'MAC位址'),
  coalesce(data ->> '主機型號', data ->> '設備型號', data ->> '型號'),
  data ->> 'WINDOWS版本',
  data ->> '是否裝防毒',
  coalesce(data ->> '狀態', data ->> '盤點狀態'),
  data ->> '盤點人員',
  data ->> '盤點時間',
  coalesce(data ->> '備註', data ->> '盤點備註'),
  now()
from public.sheet_records
where source_key like 'assets_%'
on conflict (source_record_id) do update set
  source_key = excluded.source_key,
  source_label = excluded.source_label,
  record_key = excluded.record_key,
  asset_type = excluded.asset_type,
  asset_name = excluded.asset_name,
  department = excluded.department,
  user_name = excluded.user_name,
  ip_address = excluded.ip_address,
  mac_address = excluded.mac_address,
  model = excluded.model,
  windows_version = excluded.windows_version,
  antivirus_installed = excluded.antivirus_installed,
  status = excluded.status,
  inventory_staff = excluded.inventory_staff,
  inventory_time = excluded.inventory_time,
  note = excluded.note;

insert into public.sop_documents (
  source_record_id, sop_id, sop_name, category, system_name, department,
  version, status, owner, keywords, drive_url, note, updated_at
)
select
  id,
  data ->> 'sop_id',
  data ->> 'sop_name',
  data ->> 'category',
  data ->> 'system_name',
  data ->> 'department',
  data ->> 'version',
  data ->> 'status',
  data ->> 'owner',
  data ->> 'keywords',
  data ->> 'drive_url',
  data ->> 'note',
  now()
from public.sheet_records
where source_key = 'sop'
on conflict (sop_id) do update set
  source_record_id = excluded.source_record_id,
  sop_name = excluded.sop_name,
  category = excluded.category,
  system_name = excluded.system_name,
  department = excluded.department,
  version = excluded.version,
  status = excluded.status,
  owner = excluded.owner,
  keywords = excluded.keywords,
  drive_url = excluded.drive_url,
  note = excluded.note;

alter table public.contacts enable row level security;
alter table public.submitted_documents enable row level security;
alter table public.anydesk_devices enable row level security;
alter table public.contracts enable row level security;
alter table public.mobile_contracts enable row level security;
alter table public.assets enable row level security;
alter table public.sop_documents enable row level security;

grant select, insert, update, delete on public.contacts to service_role;
grant select, insert, update, delete on public.submitted_documents to service_role;
grant select, insert, update, delete on public.anydesk_devices to service_role;
grant select, insert, update, delete on public.contracts to service_role;
grant select, insert, update, delete on public.mobile_contracts to service_role;
grant select, insert, update, delete on public.assets to service_role;
grant select, insert, update, delete on public.sop_documents to service_role;

select
  (select count(*) from public.contacts) as contacts,
  (select count(*) from public.submitted_documents) as submitted_documents,
  (select count(*) from public.anydesk_devices) as anydesk_devices,
  (select count(*) from public.contracts) as contracts,
  (select count(*) from public.mobile_contracts) as mobile_contracts,
  (select count(*) from public.assets) as assets,
  (select count(*) from public.sop_documents) as sop_documents;
