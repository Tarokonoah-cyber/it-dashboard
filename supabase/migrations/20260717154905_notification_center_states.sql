create table if not exists public.notification_states (
  notification_key text primary key
    check (char_length(btrim(notification_key)) between 1 and 240),
  source_type text not null
    check (char_length(btrim(source_type)) between 1 and 80),
  source_id text not null
    check (char_length(btrim(source_id)) between 1 and 200),
  read_at timestamptz,
  snoozed_until timestamptz,
  line_pushed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_states_unread_idx
  on public.notification_states (updated_at desc)
  where read_at is null;

create index if not exists notification_states_snoozed_idx
  on public.notification_states (snoozed_until)
  where snoozed_until is not null;

alter table public.notification_states enable row level security;

revoke all on table public.notification_states from anon, authenticated;
grant select, insert, update, delete
  on table public.notification_states to service_role;

drop policy if exists notification_states_service_role_select
  on public.notification_states;
create policy notification_states_service_role_select
on public.notification_states
for select to service_role using (true);

drop policy if exists notification_states_service_role_insert
  on public.notification_states;
create policy notification_states_service_role_insert
on public.notification_states
for insert to service_role with check (true);

drop policy if exists notification_states_service_role_update
  on public.notification_states;
create policy notification_states_service_role_update
on public.notification_states
for update to service_role using (true) with check (true);

drop policy if exists notification_states_service_role_delete
  on public.notification_states;
create policy notification_states_service_role_delete
on public.notification_states
for delete to service_role using (true);

notify pgrst, 'reload schema';
