create index if not exists recurring_task_occurrences_todo_id_idx
  on public.recurring_task_occurrences (todo_id)
  where todo_id is not null;

create index if not exists recurring_task_occurrences_work_log_id_idx
  on public.recurring_task_occurrences (work_log_id)
  where work_log_id is not null;
