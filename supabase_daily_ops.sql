create extension if not exists pgcrypto;

create table if not exists public.network_test_rooms (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  room_no text not null,
  source text not null default 'line',
  raw_message text not null default '',
  status text not null default '待測試',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_no)
);

create index if not exists network_test_rooms_date_idx
  on public.network_test_rooms (date desc, room_no asc);

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

create index if not exists line_webhook_logs_created_at_idx
  on public.line_webhook_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists network_test_rooms_set_updated_at on public.network_test_rooms;
create trigger network_test_rooms_set_updated_at
before update on public.network_test_rooms
for each row execute function public.set_updated_at();

alter table public.network_test_rooms enable row level security;
alter table public.line_webhook_logs enable row level security;

grant select, insert, update, delete on table public.network_test_rooms to service_role;
grant select, insert, update, delete on table public.line_webhook_logs to service_role;

drop policy if exists network_test_rooms_service_role_select on public.network_test_rooms;
create policy network_test_rooms_service_role_select
on public.network_test_rooms for select to service_role using (true);

drop policy if exists network_test_rooms_service_role_insert on public.network_test_rooms;
create policy network_test_rooms_service_role_insert
on public.network_test_rooms for insert to service_role with check (true);

drop policy if exists network_test_rooms_service_role_update on public.network_test_rooms;
create policy network_test_rooms_service_role_update
on public.network_test_rooms for update to service_role using (true) with check (true);

drop policy if exists network_test_rooms_service_role_delete on public.network_test_rooms;
create policy network_test_rooms_service_role_delete
on public.network_test_rooms for delete to service_role using (true);

drop policy if exists line_webhook_logs_service_role_select on public.line_webhook_logs;
create policy line_webhook_logs_service_role_select
on public.line_webhook_logs for select to service_role using (true);

drop policy if exists line_webhook_logs_service_role_insert on public.line_webhook_logs;
create policy line_webhook_logs_service_role_insert
on public.line_webhook_logs for insert to service_role with check (true);

drop policy if exists line_webhook_logs_service_role_update on public.line_webhook_logs;
create policy line_webhook_logs_service_role_update
on public.line_webhook_logs for update to service_role using (true) with check (true);

drop policy if exists line_webhook_logs_service_role_delete on public.line_webhook_logs;
create policy line_webhook_logs_service_role_delete
on public.line_webhook_logs for delete to service_role using (true);
