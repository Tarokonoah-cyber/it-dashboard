alter table public.work_logs
  add column if not exists external_event_at timestamptz,
  add column if not exists external_updated_at timestamptz,
  add column if not exists external_data jsonb;

create table if not exists public.line_repair_webhook_events (
  event_id text primary key
    check (char_length(btrim(event_id)) between 1 and 240),
  event_type text not null
    check (event_type in (
      'repair.created',
      'repair.in_progress',
      'repair.completed',
      'repair.closed',
      'repair.reopened',
      'repair.cancelled',
      'repair.updated'
    )),
  occurred_at timestamptz not null,
  repair_updated_at timestamptz not null,
  repair_external_id text not null
    check (char_length(btrim(repair_external_id)) between 1 and 200),
  work_log_id text references public.work_logs(id) on delete set null,
  result text not null default 'processing'
    check (result in ('processing', 'processed', 'stale')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists line_repair_webhook_events_repair_idx
  on public.line_repair_webhook_events(repair_external_id, repair_updated_at desc, occurred_at desc);

create index if not exists line_repair_webhook_events_received_idx
  on public.line_repair_webhook_events(received_at desc);

create index if not exists work_logs_line_repair_updated_idx
  on public.work_logs(external_updated_at desc, external_event_at desc)
  where source = 'line-repair';

alter table public.line_repair_webhook_events enable row level security;

revoke all on table public.line_repair_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table public.line_repair_webhook_events to service_role;

create or replace function public.process_line_repair_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_repair_updated_at timestamptz,
  p_repair_no text,
  p_task_state text,
  p_work jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_claimed_event_id text;
  v_existing public.work_logs%rowtype;
  v_existing_event public.line_repair_webhook_events%rowtype;
  v_work_id text;
  v_was_open boolean := false;
  v_action text;
  v_status text := btrim(coalesce(p_work->>'status', ''));
  v_impact text := btrim(coalesce(p_work->>'impact', ''));
begin
  if btrim(coalesce(p_event_id, '')) = ''
    or btrim(coalesce(p_event_type, '')) = ''
    or p_occurred_at is null
    or p_repair_updated_at is null
    or btrim(coalesce(p_repair_no, '')) = ''
    or p_task_state not in ('open', 'completed', 'cancelled')
    or jsonb_typeof(p_work) <> 'object'
  then
    raise exception 'Invalid LINE repair event';
  end if;

  if v_status not in ('未完成', '已完成', '已取消')
    or v_impact not in ('一般', '重要')
    or btrim(coalesce(p_work->>'title', '')) = ''
    or btrim(coalesce(p_work->>'sourceId', '')) <> btrim(p_repair_no)
    or btrim(coalesce(p_work->>'source', '')) <> 'line-repair'
  then
    raise exception 'Invalid LINE repair work payload';
  end if;

  if (p_task_state = 'open' and v_status <> '未完成')
    or (p_task_state = 'completed' and v_status <> '已完成')
    or (p_task_state = 'cancelled' and v_status <> '已取消')
  then
    raise exception 'LINE repair task state does not match work status';
  end if;

  insert into public.line_repair_webhook_events (
    event_id,
    event_type,
    occurred_at,
    repair_updated_at,
    repair_external_id
  ) values (
    btrim(p_event_id),
    btrim(p_event_type),
    p_occurred_at,
    p_repair_updated_at,
    btrim(p_repair_no)
  )
  on conflict (event_id) do nothing
  returning event_id into v_claimed_event_id;

  if v_claimed_event_id is null then
    select *
    into v_existing_event
    from public.line_repair_webhook_events
    where event_id = btrim(p_event_id);

    return jsonb_build_object(
      'eventId', btrim(p_event_id),
      'duplicate', true,
      'stale', coalesce(v_existing_event.result = 'stale', false),
      'action', 'duplicate',
      'taskId', v_existing_event.work_log_id
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('line-repair:' || btrim(p_repair_no), 0));

  select *
  into v_existing
  from public.work_logs
  where source = 'line-repair'
    and source_id = btrim(p_repair_no)
  limit 1
  for update;

  if found then
    v_was_open := coalesce(v_existing.status, '') not in ('已完成', '完成', 'Done', 'done', '已取消', '取消', 'cancelled');

    if v_existing.external_updated_at is not null
      and (
        p_repair_updated_at < v_existing.external_updated_at
        or (
          p_repair_updated_at = v_existing.external_updated_at
          and v_existing.external_event_at is not null
          and p_occurred_at <= v_existing.external_event_at
        )
      )
    then
      update public.line_repair_webhook_events
      set work_log_id = v_existing.id,
          result = 'stale',
          processed_at = now()
      where event_id = v_claimed_event_id;

      return jsonb_build_object(
        'eventId', v_claimed_event_id,
        'duplicate', false,
        'stale', true,
        'action', 'stale',
        'taskId', v_existing.id
      );
    end if;
  end if;

  if p_task_state = 'open' then
    if v_existing.id is null then
      v_action := 'created';
    elsif not v_was_open or p_event_type = 'repair.reopened' then
      v_action := 'reopened';
    else
      v_action := 'updated';
    end if;
  elsif p_task_state = 'completed' then
    v_action := 'completed';
  else
    v_action := 'cancelled';
  end if;

  insert into public.work_logs (
    date,
    staff,
    title,
    category,
    status,
    impact,
    description,
    note,
    source,
    source_id,
    sort_order,
    external_event_at,
    external_updated_at,
    external_data,
    created_at,
    updated_at
  ) values (
    (p_work->>'date')::date,
    nullif(btrim(coalesce(p_work->>'staff', '')), ''),
    btrim(p_work->>'title'),
    nullif(btrim(coalesce(p_work->>'category', '')), ''),
    v_status,
    v_impact,
    nullif(btrim(coalesce(p_work->>'description', '')), ''),
    nullif(btrim(coalesce(p_work->>'note', '')), ''),
    'line-repair',
    btrim(p_repair_no),
    case when p_task_state = 'open' then 0 else null end,
    p_occurred_at,
    p_repair_updated_at,
    coalesce(p_work->'externalData', '{}'::jsonb),
    coalesce(nullif(p_work->>'createdAt', '')::timestamptz, p_occurred_at),
    now()
  )
  on conflict (source, source_id)
    where source is not null and source_id is not null
  do update set
    date = excluded.date,
    staff = excluded.staff,
    title = excluded.title,
    category = excluded.category,
    status = excluded.status,
    impact = excluded.impact,
    description = excluded.description,
    note = excluded.note,
    sort_order = case
      when p_task_state <> 'open' then null
      when p_event_type in ('repair.created', 'repair.reopened') or not v_was_open then 0
      else public.work_logs.sort_order
    end,
    external_event_at = excluded.external_event_at,
    external_updated_at = excluded.external_updated_at,
    external_data = excluded.external_data,
    updated_at = now()
  returning id into v_work_id;

  update public.line_repair_webhook_events
  set work_log_id = v_work_id,
      result = 'processed',
      processed_at = now()
  where event_id = v_claimed_event_id;

  return jsonb_build_object(
    'eventId', v_claimed_event_id,
    'duplicate', false,
    'stale', false,
    'action', v_action,
    'taskId', v_work_id
  );
end;
$$;

revoke execute on function public.process_line_repair_event(text, text, timestamptz, timestamptz, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_line_repair_event(text, text, timestamptz, timestamptz, text, text, jsonb)
  to service_role;

notify pgrst, 'reload schema';
