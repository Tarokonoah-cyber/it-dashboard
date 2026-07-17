import "server-only";

import { supabaseRequest } from "./supabase-rest";
import { buildInspectionReportSummary, buildWorkReportSummary, normalizeInspectionRecord, normalizeWorkReportRow } from "./reporting";

const PAGE_SIZE = 1000;

function safeDate(value, name) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error(`${name}格式不正確`), { name: "ValidationError" });
  return date;
}

export function parseReportFilters(searchParams) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = safeDate(searchParams.get("start") || `${today.slice(0, 7)}-01`, "開始日期");
  const end = safeDate(searchParams.get("end") || today, "結束日期");
  if (start > end) throw Object.assign(new Error("開始日期不可晚於結束日期"), { name: "ValidationError" });
  const type = String(searchParams.get("type") || "work").trim();
  if (!new Set(["work", "inspection"]).has(type)) throw Object.assign(new Error("不支援此報表類型"), { name: "ValidationError" });
  return {
    type,
    start,
    end,
    workType: String(searchParams.get("workType") || "").trim(),
    system: String(searchParams.get("system") || "").trim(),
    department: String(searchParams.get("department") || "").trim(),
    status: String(searchParams.get("status") || "").trim(),
    inspector: String(searchParams.get("inspector") || "").trim(),
    period: new Set(["daily", "monthly", "all"]).has(searchParams.get("period")) ? searchParams.get("period") : "daily"
  };
}

async function fetchPaged(table, baseQuery) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await supabaseRequest(table, `${baseQuery}&limit=${PAGE_SIZE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function matches(value, selected) {
  return !selected || String(value || "") === selected;
}

async function loadWorkReport(filters) {
  const rawRows = await fetchPaged("work_logs", `select=*&date=gte.${encodeURIComponent(filters.start)}&date=lte.${encodeURIComponent(filters.end)}&order=date.asc,created_at.asc`);
  const rows = rawRows.map(normalizeWorkReportRow).filter((row) =>
    matches(row.workType, filters.workType) && matches(row.system, filters.system) && matches(row.department, filters.department) && matches(row.status, filters.status)
  );
  return { type: "work", filters, rows, summary: buildWorkReportSummary(rows) };
}

async function loadInspectionItems(recordIds) {
  const items = [];
  for (let index = 0; index < recordIds.length; index += 100) {
    const chunk = recordIds.slice(index, index + 100);
    if (!chunk.length) continue;
    items.push(...await fetchPaged("inspection_record_items", `select=*&inspection_record_id=in.(${chunk.map(encodeURIComponent).join(",")})&order=category.asc,item_name.asc`));
  }
  return items;
}

async function loadInspectionReport(filters) {
  const rawRecords = await fetchPaged("inspection_records", `select=*&inspection_date=gte.${encodeURIComponent(filters.start)}&inspection_date=lte.${encodeURIComponent(filters.end)}&order=inspection_date.asc,updated_at.asc`);
  const selectedRecords = rawRecords.filter((row) => matches(row.inspector_name, filters.inspector) && matches(row.overall_status, filters.status));
  const items = await loadInspectionItems(selectedRecords.map((row) => row.id));
  const byRecord = new Map();
  items.forEach((item) => {
    if (!byRecord.has(item.inspection_record_id)) byRecord.set(item.inspection_record_id, []);
    byRecord.get(item.inspection_record_id).push(item);
  });
  const records = selectedRecords.map((record) => normalizeInspectionRecord({ ...record, items: byRecord.get(record.id) || [] }));
  return { type: "inspection", filters, rows: records, summary: buildInspectionReportSummary(records, filters.period) };
}

export async function loadReport(filters) {
  return filters.type === "inspection" ? loadInspectionReport(filters) : loadWorkReport(filters);
}
