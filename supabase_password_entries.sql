-- Password management index schema for the dashboard.
-- Store metadata and Bitwarden references only.
-- Do not store real passwords, tokens, internal seed rows, exported Excel data,
-- or other secret values in this table or repository.

create extension if not exists pgcrypto;

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
  'Dashboard password index metadata only. Real passwords and secrets must stay in the approved vault.';

comment on column public.password_entries.password_item is
  'Vault item label or reference only. Do not store actual passwords in this column.';

create index if not exists password_entries_category_system_idx
  on public.password_entries (category, system_name);

create index if not exists password_entries_search_idx
  on public.password_entries using gin (
    to_tsvector(
      'simple',
      category || ' ' ||
      system_name || ' ' ||
      login_url || ' ' ||
      username || ' ' ||
      password_item || ' ' ||
      notes || ' ' ||
      bitwarden_item_name
    )
  );

create or replace function public.set_password_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists password_entries_set_updated_at on public.password_entries;
create trigger password_entries_set_updated_at
before update on public.password_entries
for each row execute function public.set_password_entries_updated_at();

alter table public.password_entries enable row level security;

grant select, insert, update, delete on table public.password_entries to service_role;

drop policy if exists password_entries_service_role_select on public.password_entries;
create policy password_entries_service_role_select
on public.password_entries for select to service_role using (true);

drop policy if exists password_entries_service_role_insert on public.password_entries;
create policy password_entries_service_role_insert
on public.password_entries for insert to service_role with check (true);

drop policy if exists password_entries_service_role_update on public.password_entries;
create policy password_entries_service_role_update
on public.password_entries for update to service_role using (true) with check (true);

drop policy if exists password_entries_service_role_delete on public.password_entries;
create policy password_entries_service_role_delete
on public.password_entries for delete to service_role using (true);

notify pgrst, 'reload schema';
