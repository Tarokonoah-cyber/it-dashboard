create extension if not exists pgcrypto;

create table if not exists public.recurring_task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  note text not null default '' check (char_length(note) <= 1000),
  priority text not null default '一般' check (priority in ('一般', '重要')),
  owner text not null default '共同' check (char_length(btrim(owner)) between 1 and 120),
  recurrence_kind text not null check (recurrence_kind in ('daily', 'weekdays', 'weekly', 'monthly')),
  weekday smallint check (weekday between 1 and 7),
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  last_checked_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_task_templates_date_range check (end_date is null or end_date >= start_date),
  constraint recurring_task_templates_rule_fields check (
    (recurrence_kind = 'weekly' and weekday is not null and day_of_month is null)
    or (recurrence_kind = 'monthly' and day_of_month is not null and weekday is null)
    or (recurrence_kind in ('daily', 'weekdays') and weekday is null and day_of_month is null)
  )
);

create index if not exists recurring_task_templates_active_idx
  on public.recurring_task_templates (is_active, archived_at, start_date);

create table if not exists public.recurring_task_occurrences (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.recurring_task_templates(id) on delete restrict,
  occurrence_date date not null,
  todo_id text references public.todo_logs(id) on delete set null,
  work_log_id text references public.work_logs(id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'generated', 'failed')),
  error_message text not null default '' check (char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, occurrence_date)
);

create index if not exists recurring_task_occurrences_date_idx
  on public.recurring_task_occurrences (occurrence_date desc, status);

create table if not exists public.line_push_logs (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique check (char_length(delivery_key) between 1 and 160),
  scheduled_date date not null,
  kind text not null check (kind in ('daily_digest', 'test')),
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed', 'skipped')),
  item_counts jsonb not null default '{}'::jsonb,
  response_status integer,
  error_message text not null default '' check (char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists line_push_logs_created_at_idx
  on public.line_push_logs (created_at desc);

alter table public.recurring_task_templates enable row level security;
alter table public.recurring_task_occurrences enable row level security;
alter table public.line_push_logs enable row level security;

revoke all on table public.recurring_task_templates from anon, authenticated;
revoke all on table public.recurring_task_occurrences from anon, authenticated;
revoke all on table public.line_push_logs from anon, authenticated;

grant select, insert, update, delete on table public.recurring_task_templates to service_role;
grant select, insert, update, delete on table public.recurring_task_occurrences to service_role;
grant select, insert, update, delete on table public.line_push_logs to service_role;

notify pgrst, 'reload schema';
