-- Optional helper views for browsing imported Sheet data in Supabase.
-- These views keep sheet_records as the import/staging table, but expose
-- flattened columns so the Supabase Table Editor is readable.

create or replace view public.v_sheet_contacts as
select
  id,
  record_key,
  data ->> '單位' as department,
  data ->> '職稱' as title_zh,
  data ->> 'Position' as title_en,
  data ->> '姓名' as name_zh,
  data ->> 'Name' as name_en,
  data ->> '分機 Extension' as extension,
  data ->> '辦公室專線 Office' as office_phone,
  data ->> '中華電信 *55' as cht_mobile,
  data ->> '個人行動電話' as mobile_phone,
  data ->> 'E-mail address' as email,
  data ->> '備註' as note,
  updated_at
from public.sheet_records
where source_key = 'contacts';

create or replace view public.v_sheet_documents as
select
  id,
  record_key,
  data ->> '日期' as doc_date,
  data ->> '月份' as doc_month,
  data ->> '單據格式' as document_type,
  data ->> '成本歸屬' as cost_center,
  data ->> '項目說明' as description,
  data ->> '總金額' as total_amount,
  data ->> '備註' as note,
  data ->> '最後更新時間' as source_updated_at,
  updated_at
from public.sheet_records
where source_key = 'documents';

create or replace view public.v_sheet_contracts as
select
  id,
  source_key,
  record_key,
  data ->> 'id' as contract_id,
  data ->> 'contract_name' as contract_name,
  data ->> 'vendor' as vendor,
  data ->> 'start_date' as start_date,
  data ->> 'end_date' as end_date,
  data ->> 'amount' as amount,
  data ->> 'owner' as owner,
  data ->> 'status' as status,
  data ->> 'note' as note,
  updated_at
from public.sheet_records
where source_key in ('contracts', 'mobile_contracts');

create or replace view public.v_sheet_assets as
select
  id,
  source_key,
  source_label,
  record_key,
  coalesce(data ->> '資產類型', source_label) as asset_type,
  coalesce(data ->> '設備名稱', data ->> '電腦名稱') as asset_name,
  data ->> '部門' as department,
  data ->> '使用人' as user_name,
  data ->> 'IP位置' as ip_address,
  coalesce(data ->> '主機型號', data ->> '設備型號', data ->> '型號') as model,
  coalesce(data ->> '狀態', data ->> '盤點狀態') as status,
  coalesce(data ->> '備註', data ->> '盤點備註') as note,
  updated_at
from public.sheet_records
where source_key like 'assets_%';

create or replace view public.v_sheet_sop as
select
  id,
  record_key,
  data ->> 'sop_id' as sop_id,
  data ->> 'sop_name' as sop_name,
  data ->> 'category' as category,
  data ->> 'system_name' as system_name,
  data ->> 'department' as department,
  data ->> 'version' as version,
  data ->> 'status' as status,
  data ->> 'owner' as owner,
  data ->> 'drive_url' as drive_url,
  updated_at
from public.sheet_records
where source_key = 'sop';
