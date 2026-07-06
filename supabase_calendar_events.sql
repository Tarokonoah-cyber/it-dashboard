create sequence if not exists public.calendar_events_seq start 1;

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

alter table public.calendar_events enable row level security;

create index if not exists calendar_events_event_date_idx
  on public.calendar_events (event_date asc, event_time asc nulls first, created_at asc);

grant select, insert, update, delete on table public.calendar_events to service_role;
grant usage, select on sequence public.calendar_events_seq to service_role;

notify pgrst, 'reload schema';
