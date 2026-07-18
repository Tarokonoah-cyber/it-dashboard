alter table public.line_push_logs
  add column if not exists notification_keys jsonb not null default '[]'::jsonb,
  add column if not exists retry_key uuid,
  add column if not exists request_id text,
  add column if not exists accepted_request_id text;

update public.line_push_logs
set retry_key = gen_random_uuid()
where retry_key is null;

alter table public.line_push_logs
  alter column retry_key set default gen_random_uuid(),
  alter column retry_key set not null;

alter table public.line_push_logs
  drop constraint if exists line_push_logs_kind_check;

alter table public.line_push_logs
  add constraint line_push_logs_kind_check
  check (kind in ('daily_digest', 'critical_event', 'critical_follow_up', 'manual', 'test'));

alter table public.line_push_logs
  drop constraint if exists line_push_logs_notification_keys_check;

alter table public.line_push_logs
  add constraint line_push_logs_notification_keys_check
  check (jsonb_typeof(notification_keys) = 'array');

create index if not exists line_push_logs_kind_created_at_idx
  on public.line_push_logs (kind, created_at desc);

notify pgrst, 'reload schema';
