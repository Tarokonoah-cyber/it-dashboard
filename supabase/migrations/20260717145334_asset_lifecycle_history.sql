alter table public.assets
  add column if not exists purchase_date date,
  add column if not exists purchase_vendor text,
  add column if not exists purchase_cost numeric(12, 2),
  add column if not exists serial_number text,
  add column if not exists warranty_end_date date,
  add column if not exists warranty_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assets'::regclass
      and conname = 'assets_purchase_cost_nonnegative'
  ) then
    alter table public.assets
      add constraint assets_purchase_cost_nonnegative
      check (purchase_cost is null or purchase_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assets'::regclass
      and conname = 'assets_warranty_date_order'
  ) then
    alter table public.assets
      add constraint assets_warranty_date_order
      check (
        purchase_date is null
        or warranty_end_date is null
        or warranty_end_date >= purchase_date
      );
  end if;
end
$$;

create index if not exists assets_warranty_end_date_idx
  on public.assets (warranty_end_date)
  where warranty_end_date is not null;

create table if not exists public.asset_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  service_date date not null,
  event_type text not null default '維修'
    check (event_type in ('維修', '保養', '更換', '送修', '其他')),
  summary text not null
    check (char_length(btrim(summary)) between 1 and 200),
  vendor text,
  cost numeric(12, 2)
    check (cost is null or cost >= 0),
  status text not null default '已完成'
    check (status in ('待處理', '處理中', '已完成', '取消')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_maintenance_records_asset_date_idx
  on public.asset_maintenance_records (asset_id, service_date desc, created_at desc);

drop trigger if exists asset_maintenance_records_set_updated_at
  on public.asset_maintenance_records;
create trigger asset_maintenance_records_set_updated_at
before update on public.asset_maintenance_records
for each row execute function public.set_updated_at();

alter table public.asset_maintenance_records enable row level security;

revoke all on table public.asset_maintenance_records from anon, authenticated;
grant select, insert, update, delete
  on table public.asset_maintenance_records to service_role;
grant select, insert, update
  on table public.assets to service_role;

drop policy if exists asset_maintenance_records_service_role_select
  on public.asset_maintenance_records;
create policy asset_maintenance_records_service_role_select
on public.asset_maintenance_records
for select to service_role using (true);

drop policy if exists asset_maintenance_records_service_role_insert
  on public.asset_maintenance_records;
create policy asset_maintenance_records_service_role_insert
on public.asset_maintenance_records
for insert to service_role with check (true);

drop policy if exists asset_maintenance_records_service_role_update
  on public.asset_maintenance_records;
create policy asset_maintenance_records_service_role_update
on public.asset_maintenance_records
for update to service_role using (true) with check (true);

drop policy if exists asset_maintenance_records_service_role_delete
  on public.asset_maintenance_records;
create policy asset_maintenance_records_service_role_delete
on public.asset_maintenance_records
for delete to service_role using (true);

notify pgrst, 'reload schema';
