create sequence if not exists public.follow_ups_seq start 1;

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
  constraint follow_ups_status_check check (current_status in ('等待回覆', '處理中', '待確認', '已完成'))
);

create index if not exists follow_ups_next_follow_date_idx
  on public.follow_ups (next_follow_date asc);

create index if not exists follow_ups_current_status_idx
  on public.follow_ups (current_status);

create index if not exists follow_ups_source_todo_id_idx
  on public.follow_ups (source_todo_id);

grant select, insert, update, delete on table public.follow_ups to service_role;
grant usage, select on sequence public.follow_ups_seq to service_role;
