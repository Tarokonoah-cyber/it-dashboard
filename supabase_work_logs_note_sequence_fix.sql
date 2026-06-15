-- Work logs data correctness hotfix.
-- Run in Supabase SQL Editor before deploying the app changes.

alter table public.work_logs
  add column if not exists note text;

create sequence if not exists public.work_logs_seq;

alter table public.work_logs
  alter column id set default ('WL-' || lpad(nextval('public.work_logs_seq')::text, 4, '0'));

select setval(
  'public.work_logs_seq',
  greatest(
    coalesce((
      select max((regexp_match(id, '^WL-(\d+)$'))[1]::bigint)
      from public.work_logs
      where id ~ '^WL-\d+$'
    ), 0),
    1
  ),
  true
);

grant usage, select on sequence public.work_logs_seq to service_role;
grant select, insert, update, delete on table public.work_logs to service_role;

notify pgrst, 'reload schema';
