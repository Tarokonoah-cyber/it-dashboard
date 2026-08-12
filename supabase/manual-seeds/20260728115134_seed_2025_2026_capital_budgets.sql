-- Manual seed only. Review the budget codes, amounts, departments and monthly
-- actuals before explicitly running this against any target database.
do $$
begin
if not exists (
  select 1 from public.budget_items where budget_year = 2025 and budget_code = 'A25-MIS001'
) then
perform public.upsert_manual_budget_item(
  null,
  jsonb_build_object(
    'budgetYear', 2025,
    'budgetCode', 'A25-MIS001',
    'itemName', '電腦及網路軟硬體更新維護費用',
    'department', '資訊室',
    'quantity', '1',
    'budgetAmount', 420000,
    'committedAmount', 0,
    'monthlyAmounts', jsonb_build_array(
      jsonb_build_object('actualYear', 2025, 'actualMonth', 4, 'amount', 24762),
      jsonb_build_object('actualYear', 2025, 'actualMonth', 5, 'amount', 81600),
      jsonb_build_object('actualYear', 2025, 'actualMonth', 9, 'amount', 54499),
      jsonb_build_object('actualYear', 2026, 'actualMonth', 1, 'amount', 38680),
      jsonb_build_object('actualYear', 2026, 'actualMonth', 6, 'amount', 38680)
    )
  ),
  '圖片資料匯入'
);
end if;

if not exists (
  select 1 from public.budget_items where budget_year = 2025 and budget_code = 'A25-MIS002'
) then
perform public.upsert_manual_budget_item(
  null,
  jsonb_build_object(
    'budgetYear', 2025,
    'budgetCode', 'A25-MIS002',
    'itemName', '餐飲部自助點餐系統',
    'department', '資訊室',
    'quantity', '1',
    'budgetAmount', 155000,
    'committedAmount', 0,
    'monthlyAmounts', '[]'::jsonb
  ),
  '圖片資料匯入'
);
end if;

if not exists (
  select 1 from public.budget_items where budget_year = 2026 and budget_code = 'A26-SEC001'
) then
perform public.upsert_manual_budget_item(
  null,
  jsonb_build_object(
    'budgetYear', 2026,
    'budgetCode', 'A26-SEC001',
    'itemName', '監視系統更新及維護',
    'department', '安全部',
    'quantity', '',
    'budgetAmount', 165000,
    'committedAmount', 0,
    'monthlyAmounts', '[]'::jsonb
  ),
  '圖片資料匯入'
);
end if;

if not exists (
  select 1 from public.budget_items where budget_year = 2026 and budget_code = 'A26-MIS001'
) then
perform public.upsert_manual_budget_item(
  null,
  jsonb_build_object(
    'budgetYear', 2026,
    'budgetCode', 'A26-MIS001',
    'itemName', '電腦及網路軟硬體更新維護費用',
    'department', '資訊室',
    'quantity', '1式',
    'budgetAmount', 420000,
    'committedAmount', 0,
    'monthlyAmounts', jsonb_build_array(
      jsonb_build_object('actualYear', 2026, 'actualMonth', 3, 'amount', 84600),
      jsonb_build_object('actualYear', 2026, 'actualMonth', 4, 'amount', 8251),
      jsonb_build_object('actualYear', 2026, 'actualMonth', 5, 'amount', 101433)
    )
  ),
  '圖片資料匯入'
);
end if;
end;
$$;
