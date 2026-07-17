create table if not exists public.dashboard_login_credentials (
  id smallint primary key default 1 check (id = 1),
  username text not null,
  password_salt text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_login_credentials enable row level security;
alter table public.dashboard_login_credentials force row level security;

revoke all on table public.dashboard_login_credentials from anon, authenticated;
grant select, insert, update on table public.dashboard_login_credentials to service_role;
