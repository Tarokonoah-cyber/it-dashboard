create table if not exists public.budget_imports (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  budget_year smallint check (budget_year between 2000 and 2200),
  data_month smallint check (data_month between 1 and 12),
  imported_by text,
  import_status text not null default 'preview'
    check (import_status in ('preview', 'succeeded', 'failed', 'superseded')),
  import_mode text check (import_mode in ('new', 'overwrite', 'version')),
  version_number integer check (version_number is null or version_number > 0),
  is_active boolean not null default false,
  replaces_import_id uuid references public.budget_imports(id) on delete set null,
  overwritten_existing boolean not null default false,
  source_sheet_names jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_sheet_names) = 'array'),
  preview_payload jsonb,
  department_count integer not null default 0 check (department_count >= 0),
  budget_item_count integer not null default 0 check (budget_item_count >= 0),
  voucher_count integer not null default 0 check (voucher_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  error_message text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    import_status in ('preview', 'failed')
    or (budget_year is not null and data_month is not null and version_number is not null)
  ),
  check (not is_active or import_status = 'succeeded')
);

create unique index if not exists budget_imports_active_period_uidx
  on public.budget_imports (budget_year, data_month)
  where is_active and import_status = 'succeeded';

create unique index if not exists budget_imports_period_version_uidx
  on public.budget_imports (budget_year, data_month, version_number)
  where version_number is not null;

create index if not exists budget_imports_hash_idx
  on public.budget_imports (file_hash, created_at desc);

create index if not exists budget_imports_created_at_idx
  on public.budget_imports (created_at desc);

create table if not exists public.budget_import_sheets (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.budget_imports(id) on delete cascade,
  sheet_name text not null,
  sheet_index integer not null check (sheet_index >= 0),
  visibility text not null default 'visible'
    check (visibility in ('visible', 'hidden', 'veryHidden')),
  classification text not null
    check (classification in ('budget_summary', 'spend_detail', 'voucher', 'historical_budget', 'unrecognized')),
  budget_year smallint check (budget_year between 2000 and 2200),
  row_count integer not null default 0 check (row_count >= 0),
  column_count integer not null default 0 check (column_count >= 0),
  merged_range_count integer not null default 0 check (merged_range_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, sheet_index)
);

create table if not exists public.budget_departments (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.budget_imports(id) on delete cascade,
  budget_year smallint not null check (budget_year between 2000 and 2200),
  department_key text not null check (char_length(btrim(department_key)) between 1 and 120),
  department_code text,
  department_name text not null check (char_length(btrim(department_name)) between 1 and 120),
  source_sheet_name text not null,
  source_row_number integer check (source_row_number is null or source_row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, budget_year, department_key)
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.budget_imports(id) on delete cascade,
  department_id uuid not null references public.budget_departments(id) on delete restrict,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 180),
  budget_year smallint not null check (budget_year between 2000 and 2200),
  budget_code text,
  item_name text not null check (char_length(btrim(item_name)) between 1 and 500),
  quantity_text text,
  budget_amount numeric(18, 2) not null check (budget_amount >= 0),
  committed_amount numeric(18, 2) not null default 0,
  source_reported_actual_amount numeric(18, 2),
  source_reported_available_amount numeric(18, 2),
  source_sheet_name text not null,
  source_row_number integer not null check (source_row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, source_key)
);

create index if not exists budget_items_filter_idx
  on public.budget_items (budget_year, department_id, budget_code);

create index if not exists budget_items_name_idx
  on public.budget_items (budget_year, item_name);

create table if not exists public.budget_monthly_amounts (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.budget_imports(id) on delete cascade,
  budget_item_id uuid not null references public.budget_items(id) on delete cascade,
  actual_year smallint not null check (actual_year between 2000 and 2200),
  actual_month smallint not null check (actual_month between 1 and 12),
  amount numeric(18, 2) not null,
  source_sheet_name text not null,
  source_row_number integer not null check (source_row_number > 0),
  source_column_number integer not null check (source_column_number > 0),
  raw_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, budget_item_id, actual_year, actual_month, source_row_number, source_column_number)
);

create index if not exists budget_monthly_amounts_period_idx
  on public.budget_monthly_amounts (actual_year, actual_month, budget_item_id);

create table if not exists public.budget_vouchers (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.budget_imports(id) on delete cascade,
  department_id uuid references public.budget_departments(id) on delete set null,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  voucher_number text,
  request_date date,
  actual_year smallint check (actual_year between 2000 and 2200),
  actual_month smallint check (actual_month between 1 and 12),
  account_code text,
  account_name text,
  description text,
  amount numeric(18, 2) not null,
  budget_code text,
  relationship_status text not null default 'unlinked'
    check (relationship_status in ('exact', 'unlinked')),
  source_category text not null default 'voucher'
    check (source_category in ('voucher', 'actual_spend', 'planned_spend')),
  source_sheet_name text not null,
  source_row_number integer not null check (source_row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (request_date is null and actual_year is null and actual_month is null)
    or (actual_year is not null and actual_month is not null)
  ),
  check (relationship_status <> 'exact' or (budget_item_id is not null and budget_code is not null))
);

create index if not exists budget_vouchers_period_idx
  on public.budget_vouchers (actual_year, actual_month, department_id);

create index if not exists budget_vouchers_number_idx
  on public.budget_vouchers (voucher_number)
  where voucher_number is not null;

create index if not exists budget_vouchers_account_idx
  on public.budget_vouchers (account_code, account_name);

drop trigger if exists budget_imports_set_updated_at on public.budget_imports;
create trigger budget_imports_set_updated_at
before update on public.budget_imports
for each row execute function public.set_updated_at();

drop trigger if exists budget_import_sheets_set_updated_at on public.budget_import_sheets;
create trigger budget_import_sheets_set_updated_at
before update on public.budget_import_sheets
for each row execute function public.set_updated_at();

drop trigger if exists budget_departments_set_updated_at on public.budget_departments;
create trigger budget_departments_set_updated_at
before update on public.budget_departments
for each row execute function public.set_updated_at();

drop trigger if exists budget_items_set_updated_at on public.budget_items;
create trigger budget_items_set_updated_at
before update on public.budget_items
for each row execute function public.set_updated_at();

drop trigger if exists budget_monthly_amounts_set_updated_at on public.budget_monthly_amounts;
create trigger budget_monthly_amounts_set_updated_at
before update on public.budget_monthly_amounts
for each row execute function public.set_updated_at();

drop trigger if exists budget_vouchers_set_updated_at on public.budget_vouchers;
create trigger budget_vouchers_set_updated_at
before update on public.budget_vouchers
for each row execute function public.set_updated_at();

alter table public.budget_imports enable row level security;
alter table public.budget_import_sheets enable row level security;
alter table public.budget_departments enable row level security;
alter table public.budget_items enable row level security;
alter table public.budget_monthly_amounts enable row level security;
alter table public.budget_vouchers enable row level security;

revoke all on table public.budget_imports from anon, authenticated;
revoke all on table public.budget_import_sheets from anon, authenticated;
revoke all on table public.budget_departments from anon, authenticated;
revoke all on table public.budget_items from anon, authenticated;
revoke all on table public.budget_monthly_amounts from anon, authenticated;
revoke all on table public.budget_vouchers from anon, authenticated;

grant select, insert, update, delete on table public.budget_imports to service_role;
grant select, insert, update, delete on table public.budget_import_sheets to service_role;
grant select, insert, update, delete on table public.budget_departments to service_role;
grant select, insert, update, delete on table public.budget_items to service_role;
grant select, insert, update, delete on table public.budget_monthly_amounts to service_role;
grant select, insert, update, delete on table public.budget_vouchers to service_role;

create or replace function public.confirm_budget_import(
  p_preview_id uuid,
  p_import_mode text,
  p_imported_by text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import public.budget_imports%rowtype;
  v_payload jsonb;
  v_existing_id uuid;
  v_version integer;
begin
  if p_import_mode not in ('new', 'overwrite', 'version') then
    raise exception using message = '匯入模式不正確';
  end if;

  select * into v_import
  from public.budget_imports
  where id = p_preview_id
  for update;

  if not found then
    raise exception using message = '找不到匯入預覽';
  end if;
  if v_import.import_status <> 'preview' then
    raise exception using message = '此匯入預覽已處理或失效';
  end if;
  if v_import.budget_year is null or v_import.data_month is null then
    raise exception using message = '無法辨識年度或月份，不可寫入正式資料';
  end if;
  if v_import.preview_payload is null then
    raise exception using message = '匯入預覽缺少伺服器解析資料';
  end if;

  v_payload := v_import.preview_payload;

  select id into v_existing_id
  from public.budget_imports
  where budget_year = v_import.budget_year
    and data_month = v_import.data_month
    and is_active
    and import_status = 'succeeded'
  order by version_number desc
  limit 1
  for update;

  if v_existing_id is not null and p_import_mode = 'new' then
    raise exception using message = format(
      '已存在 %s 年 %s 月資料。請選擇取消、覆蓋現有資料，或另存為新的匯入版本。',
      v_import.budget_year,
      v_import.data_month
    );
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.budget_imports
  where budget_year = v_import.budget_year
    and data_month = v_import.data_month;

  if v_existing_id is not null then
    update public.budget_imports
    set is_active = false,
        import_status = 'superseded'
    where id = v_existing_id;
  end if;

  update public.budget_imports
  set imported_by = nullif(btrim(p_imported_by), ''),
      import_status = 'succeeded',
      import_mode = p_import_mode,
      version_number = v_version,
      is_active = true,
      replaces_import_id = v_existing_id,
      overwritten_existing = (p_import_mode = 'overwrite' and v_existing_id is not null),
      confirmed_at = now()
  where id = p_preview_id;

  insert into public.budget_import_sheets (
    import_id, sheet_name, sheet_index, visibility, classification, budget_year,
    row_count, column_count, merged_range_count, warning_count, raw_metadata
  )
  select
    p_preview_id,
    x.sheet_name,
    x.sheet_index,
    coalesce(x.visibility, 'visible'),
    x.classification,
    x.budget_year,
    coalesce(x.row_count, 0),
    coalesce(x.column_count, 0),
    coalesce(x.merged_range_count, 0),
    coalesce(x.warning_count, 0),
    coalesce(x.raw_metadata, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(v_payload->'sheets', '[]'::jsonb)) as x(
    sheet_name text,
    sheet_index integer,
    visibility text,
    classification text,
    budget_year smallint,
    row_count integer,
    column_count integer,
    merged_range_count integer,
    warning_count integer,
    raw_metadata jsonb
  );

  insert into public.budget_departments (
    import_id, budget_year, department_key, department_code, department_name,
    source_sheet_name, source_row_number, raw_data
  )
  select
    p_preview_id,
    x.budget_year,
    x.department_key,
    x.department_code,
    x.department_name,
    x.source_sheet_name,
    x.source_row_number,
    coalesce(x.raw_data, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(v_payload->'departments', '[]'::jsonb)) as x(
    budget_year smallint,
    department_key text,
    department_code text,
    department_name text,
    source_sheet_name text,
    source_row_number integer,
    raw_data jsonb
  );

  insert into public.budget_items (
    import_id, department_id, source_key, budget_year, budget_code, item_name,
    quantity_text, budget_amount, committed_amount, source_reported_actual_amount,
    source_reported_available_amount, source_sheet_name, source_row_number, raw_data
  )
  select
    p_preview_id,
    d.id,
    x.source_key,
    x.budget_year,
    x.budget_code,
    x.item_name,
    x.quantity_text,
    x.budget_amount,
    coalesce(x.committed_amount, 0),
    x.source_reported_actual_amount,
    x.source_reported_available_amount,
    x.source_sheet_name,
    x.source_row_number,
    coalesce(x.raw_data, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(v_payload->'items', '[]'::jsonb)) as x(
    department_key text,
    source_key text,
    budget_year smallint,
    budget_code text,
    item_name text,
    quantity_text text,
    budget_amount numeric,
    committed_amount numeric,
    source_reported_actual_amount numeric,
    source_reported_available_amount numeric,
    source_sheet_name text,
    source_row_number integer,
    raw_data jsonb
  )
  join public.budget_departments d
    on d.import_id = p_preview_id
   and d.budget_year = x.budget_year
   and d.department_key = x.department_key;

  insert into public.budget_monthly_amounts (
    import_id, budget_item_id, actual_year, actual_month, amount,
    source_sheet_name, source_row_number, source_column_number, raw_value
  )
  select
    p_preview_id,
    i.id,
    x.actual_year,
    x.actual_month,
    x.amount,
    x.source_sheet_name,
    x.source_row_number,
    x.source_column_number,
    x.raw_value
  from jsonb_to_recordset(coalesce(v_payload->'monthlyAmounts', '[]'::jsonb)) as x(
    item_source_key text,
    actual_year smallint,
    actual_month smallint,
    amount numeric,
    source_sheet_name text,
    source_row_number integer,
    source_column_number integer,
    raw_value text
  )
  join public.budget_items i
    on i.import_id = p_preview_id
   and i.source_key = x.item_source_key;

  insert into public.budget_vouchers (
    import_id, department_id, budget_item_id, voucher_number, request_date,
    actual_year, actual_month, account_code, account_name, description, amount,
    budget_code, relationship_status, source_category, source_sheet_name,
    source_row_number, raw_data
  )
  select
    p_preview_id,
    d.id,
    case when x.relationship_status = 'exact' then i.id else null end,
    x.voucher_number,
    x.request_date,
    x.actual_year,
    x.actual_month,
    x.account_code,
    x.account_name,
    x.description,
    x.amount,
    x.budget_code,
    coalesce(x.relationship_status, 'unlinked'),
    coalesce(x.source_category, 'voucher'),
    x.source_sheet_name,
    x.source_row_number,
    coalesce(x.raw_data, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(v_payload->'vouchers', '[]'::jsonb)) as x(
    department_key text,
    item_source_key text,
    budget_year smallint,
    voucher_number text,
    request_date date,
    actual_year smallint,
    actual_month smallint,
    account_code text,
    account_name text,
    description text,
    amount numeric,
    budget_code text,
    relationship_status text,
    source_category text,
    source_sheet_name text,
    source_row_number integer,
    raw_data jsonb
  )
  left join public.budget_departments d
    on d.import_id = p_preview_id
   and d.budget_year = x.budget_year
   and d.department_key = x.department_key
  left join public.budget_items i
    on i.import_id = p_preview_id
   and i.source_key = x.item_source_key;

  return jsonb_build_object(
    'importId', p_preview_id,
    'version', v_version,
    'replacedImportId', v_existing_id,
    'departments', (select count(*) from public.budget_departments where import_id = p_preview_id),
    'items', (select count(*) from public.budget_items where import_id = p_preview_id),
    'monthlyAmounts', (select count(*) from public.budget_monthly_amounts where import_id = p_preview_id),
    'vouchers', (select count(*) from public.budget_vouchers where import_id = p_preview_id)
  );
end;
$$;

revoke all on function public.confirm_budget_import(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_budget_import(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
