alter table public.todo_logs
  add column if not exists sort_order integer;

with ranked_todos as (
  select
    id,
    row_number() over (order by created_at desc nulls last, id asc) as next_sort_order
  from public.todo_logs
  where sort_order is null
)
update public.todo_logs
set sort_order = ranked_todos.next_sort_order
from ranked_todos
where public.todo_logs.id = ranked_todos.id;

create index if not exists todo_logs_sort_order_idx
  on public.todo_logs (sort_order asc nulls last, created_at desc);

notify pgrst, 'reload schema';
