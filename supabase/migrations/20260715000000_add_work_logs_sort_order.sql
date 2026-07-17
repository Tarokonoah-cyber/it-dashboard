alter table public.work_logs
  add column if not exists sort_order integer;

with ranked_open_work as (
  select
    id,
    row_number() over (
      order by date desc nulls last, updated_at desc nulls last, created_at desc nulls last, id
    )::integer as next_sort_order
  from public.work_logs
  where status is null or status not in ('已完成', '完成', 'Done', 'done')
)
update public.work_logs as work
set sort_order = ranked.next_sort_order
from ranked_open_work as ranked
where work.id = ranked.id
  and work.sort_order is null;

update public.work_logs
set sort_order = null
where status in ('已完成', '完成', 'Done', 'done');

create index if not exists work_logs_open_sort_order_idx
  on public.work_logs(sort_order, updated_at desc)
  where status is null or status not in ('已完成', '完成', 'Done', 'done');

notify pgrst, 'reload schema';
