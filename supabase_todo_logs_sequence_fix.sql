-- Todo logs data correctness hotfix.
-- Run in Supabase SQL Editor if todo_logs.id starts colliding on TD-000x.

create sequence if not exists public.todo_logs_seq;

alter table public.todo_logs
  alter column id set default ('TD-' || lpad(nextval('public.todo_logs_seq')::text, 4, '0'));

select setval(
  'public.todo_logs_seq',
  greatest(
    coalesce((
      select max((regexp_match(id, '^TD-(\d+)$'))[1]::bigint)
      from public.todo_logs
      where id ~ '^TD-\d+$'
    ), 0),
    1
  ),
  true
);

grant usage, select on sequence public.todo_logs_seq to service_role;
grant select, insert, update, delete on table public.todo_logs to service_role;

notify pgrst, 'reload schema';
