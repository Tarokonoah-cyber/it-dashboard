create index if not exists line_repair_webhook_events_work_log_idx
  on public.line_repair_webhook_events(work_log_id)
  where work_log_id is not null;
