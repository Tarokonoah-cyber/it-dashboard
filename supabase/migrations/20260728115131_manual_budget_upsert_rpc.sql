create or replace function public.upsert_manual_budget_item(
  p_item_id uuid,
  p_payload jsonb,
  p_updated_by text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_budget_year smallint;
  v_budget_code text;
  v_item_name text;
  v_department_name text;
  v_department_key text;
  v_quantity_text text;
  v_budget_amount numeric(18, 2);
  v_committed_amount numeric(18, 2);
  v_import_id uuid;
  v_department_id uuid;
  v_item_id uuid;
  v_source_row integer;
  v_version integer;
  v_month record;
  v_actual numeric(18, 2);
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using message = '預算資料格式不正確';
  end if;

  v_budget_year := (p_payload->>'budgetYear')::smallint;
  v_budget_code := nullif(btrim(p_payload->>'budgetCode'), '');
  v_item_name := nullif(btrim(p_payload->>'itemName'), '');
  v_department_name := nullif(btrim(p_payload->>'department'), '');
  v_quantity_text := nullif(btrim(p_payload->>'quantity'), '');
  v_budget_amount := (p_payload->>'budgetAmount')::numeric;
  v_committed_amount := coalesce(nullif(p_payload->>'committedAmount', '')::numeric, 0);

  if v_budget_year not between 2000 and 2200 then
    raise exception using message = '預算年度不正確';
  end if;
  if v_budget_code is null or char_length(v_budget_code) > 120 then
    raise exception using message = '請輸入 120 字內的預算編號';
  end if;
  if v_item_name is null or char_length(v_item_name) > 500 then
    raise exception using message = '請輸入 500 字內的預算項目';
  end if;
  if v_department_name is null or char_length(v_department_name) > 120 then
    raise exception using message = '請輸入 120 字內的部門名稱';
  end if;
  if v_budget_amount < 0 or v_committed_amount < 0 then
    raise exception using message = '預算與送簽中金額不可為負數';
  end if;
  if jsonb_typeof(coalesce(p_payload->'monthlyAmounts', '[]'::jsonb)) <> 'array' then
    raise exception using message = '月份動支資料格式不正確';
  end if;

  select id into v_import_id
  from public.budget_imports
  where budget_year = v_budget_year
    and import_status = 'succeeded'
    and is_active
  order by data_month desc, confirmed_at desc nulls last, created_at desc
  limit 1
  for update;

  if v_import_id is null then
    select coalesce(max(version_number), 0) + 1 into v_version
    from public.budget_imports
    where budget_year = v_budget_year
      and data_month = 12;

    insert into public.budget_imports (
      original_filename,
      file_hash,
      file_size_bytes,
      budget_year,
      data_month,
      imported_by,
      import_status,
      import_mode,
      version_number,
      is_active,
      source_sheet_names,
      preview_payload,
      confirmed_at,
      source_type
    )
    values (
      format('手動維護：%s 年資本預算', v_budget_year),
      lpad(to_hex(v_budget_year::integer), 64, '0'),
      1,
      v_budget_year,
      12,
      nullif(btrim(p_updated_by), ''),
      'succeeded',
      'new',
      v_version,
      true,
      '["手動維護"]'::jsonb,
      null,
      now(),
      'manual'
    )
    returning id into v_import_id;
  end if;

  v_department_key := left(lower(regexp_replace(v_department_name, '\s+', ' ', 'g')), 120);

  insert into public.budget_departments (
    import_id,
    budget_year,
    department_key,
    department_code,
    department_name,
    source_sheet_name,
    source_row_number,
    raw_data
  )
  values (
    v_import_id,
    v_budget_year,
    v_department_key,
    null,
    v_department_name,
    '手動維護',
    1,
    jsonb_build_object('origin', 'manual', 'updatedBy', nullif(btrim(p_updated_by), ''))
  )
  on conflict (import_id, budget_year, department_key)
  do update set
    department_name = excluded.department_name,
    raw_data = public.budget_departments.raw_data || excluded.raw_data
  returning id into v_department_id;

  if exists (
    select 1
    from public.budget_items
    where import_id = v_import_id
      and lower(coalesce(budget_code, '')) = lower(v_budget_code)
      and (p_item_id is null or id <> p_item_id)
  ) then
    raise exception using message = format('預算編號 %s 已存在', v_budget_code);
  end if;

  if p_item_id is not null then
    select id, source_row_number
      into v_item_id, v_source_row
    from public.budget_items
    where id = p_item_id
    for update;

    if v_item_id is null then
      raise exception using message = '找不到要修改的預算項目';
    end if;

    update public.budget_items
    set import_id = v_import_id,
        department_id = v_department_id,
        source_key = 'manual:' || lower(v_budget_code),
        budget_year = v_budget_year,
        budget_code = v_budget_code,
        item_name = v_item_name,
        quantity_text = v_quantity_text,
        budget_amount = v_budget_amount,
        committed_amount = v_committed_amount,
        source_sheet_name = '手動維護',
        raw_data = raw_data || jsonb_build_object(
          'origin', 'manual',
          'updatedBy', nullif(btrim(p_updated_by), '')
        )
    where id = v_item_id;
  else
    select coalesce(max(source_row_number), 0) + 1 into v_source_row
    from public.budget_items
    where import_id = v_import_id;

    insert into public.budget_items (
      import_id,
      department_id,
      source_key,
      budget_year,
      budget_code,
      item_name,
      quantity_text,
      budget_amount,
      committed_amount,
      source_sheet_name,
      source_row_number,
      raw_data
    )
    values (
      v_import_id,
      v_department_id,
      'manual:' || lower(v_budget_code),
      v_budget_year,
      v_budget_code,
      v_item_name,
      v_quantity_text,
      v_budget_amount,
      v_committed_amount,
      '手動維護',
      v_source_row,
      jsonb_build_object('origin', 'manual', 'updatedBy', nullif(btrim(p_updated_by), ''))
    )
    returning id into v_item_id;
  end if;

  delete from public.budget_monthly_amounts
  where budget_item_id = v_item_id;

  for v_month in
    select
      (entry->>'actualYear')::smallint as actual_year,
      (entry->>'actualMonth')::smallint as actual_month,
      (entry->>'amount')::numeric as amount
    from jsonb_array_elements(coalesce(p_payload->'monthlyAmounts', '[]'::jsonb)) as entry
  loop
    if v_month.actual_year not between 2000 and 2200
      or v_month.actual_month not between 1 and 12 then
      raise exception using message = '動支年月不正確';
    end if;

    if v_month.amount <> 0 then
      insert into public.budget_monthly_amounts (
        import_id,
        budget_item_id,
        actual_year,
        actual_month,
        amount,
        source_sheet_name,
        source_row_number,
        source_column_number,
        raw_value
      )
      values (
        v_import_id,
        v_item_id,
        v_month.actual_year,
        v_month.actual_month,
        v_month.amount,
        '手動維護',
        v_source_row,
        v_month.actual_month,
        v_month.amount::text
      );
    end if;
  end loop;

  select coalesce(sum(amount), 0) into v_actual
  from public.budget_monthly_amounts
  where budget_item_id = v_item_id;

  update public.budget_items
  set source_reported_actual_amount = v_actual,
      source_reported_available_amount = v_budget_amount - v_actual - v_committed_amount
  where id = v_item_id;

  update public.budget_imports
  set imported_by = coalesce(nullif(btrim(p_updated_by), ''), imported_by),
      department_count = (
        select count(*) from public.budget_departments where import_id = v_import_id
      ),
      budget_item_count = (
        select count(*) from public.budget_items where import_id = v_import_id
      ),
      confirmed_at = now()
  where id = v_import_id;

  return jsonb_build_object(
    'id', v_item_id,
    'budgetYear', v_budget_year,
    'budgetCode', v_budget_code
  );
end;
$$;

revoke all on function public.upsert_manual_budget_item(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.upsert_manual_budget_item(uuid, jsonb, text)
  to service_role;

notify pgrst, 'reload schema';
