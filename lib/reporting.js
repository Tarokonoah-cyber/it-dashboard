const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MONTHLY_INSPECTION_ITEMS = new Set(["NAS / 備份", "德安備份", "OPERA 備份"]);

export function cleanReportText(value, fallback = "") {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

export function dateKey(value) {
  return cleanReportText(value).slice(0, 10);
}

export function normalizeWorkReportRow(row) {
  const workDate = dateKey(row?.date || row?.workDate || row?.work_date || row?.created_at);
  return {
    id: cleanReportText(row?.id || row?.record_key || `${workDate}-${row?.title || "work"}`),
    workDate,
    summary: cleanReportText(row?.summary || row?.title || row?.description || row?.subject || row?.content, "未命名工作"),
    workType: cleanReportText(row?.workType || row?.work_type || row?.category || row?.type, "其他"),
    system: cleanReportText(row?.system || row?.related_system || row?.service || row?.related_sop_name, "其他"),
    department: cleanReportText(row?.targetDepartment || row?.target_department || row?.department || row?.service_scope || row?.impact_scope, "未分類"),
    status: cleanReportText(row?.status, "未開始"),
    priority: cleanReportText(row?.priority, "一般"),
    owner: cleanReportText(row?.owner || row?.assignee, ""),
    note: cleanReportText(row?.note || row?.remark || row?.action, "")
  };
}

export function countReportRows(rows, key) {
  return rows.reduce((map, row) => {
    const label = cleanReportText(row?.[key], "未分類");
    map[label] = (map[label] || 0) + 1;
    return map;
  }, {});
}

export function buildWorkReportSummary(rows) {
  const records = Array.isArray(rows) ? rows : [];
  const completed = records.filter((row) => DONE_STATUSES.has(cleanReportText(row.status))).length;
  return {
    total: records.length,
    completed,
    open: records.length - completed,
    completionRate: records.length ? Math.round((completed / records.length) * 100) : 0,
    byType: countReportRows(records, "workType"),
    bySystem: countReportRows(records, "system"),
    byDepartment: countReportRows(records, "department"),
    byStatus: countReportRows(records, "status")
  };
}

export function inspectionItemPeriod(item) {
  const explicit = cleanReportText(item?.period);
  if (explicit === "daily" || explicit === "monthly") return explicit;
  return MONTHLY_INSPECTION_ITEMS.has(cleanReportText(item?.item_name)) ? "monthly" : "daily";
}

export function normalizeInspectionRecord(record) {
  const items = (Array.isArray(record?.items) ? record.items : []).map((item) => ({
    id: cleanReportText(item.id),
    inspectionRecordId: cleanReportText(item.inspection_record_id || record?.id),
    date: dateKey(record?.inspection_date),
    inspector: cleanReportText(record?.inspector_name, "-"),
    category: cleanReportText(item.category, "未分類"),
    itemName: cleanReportText(item.item_name, "未命名項目"),
    period: inspectionItemPeriod(item),
    status: cleanReportText(item.status, "未檢查"),
    issue: cleanReportText(item.issue_description),
    handlingStatus: cleanReportText(item.handling_status, "未處理"),
    handlingMethod: cleanReportText(item.handling_method),
    note: cleanReportText(item.note)
  }));
  return {
    id: cleanReportText(record?.id),
    date: dateKey(record?.inspection_date),
    inspector: cleanReportText(record?.inspector_name, "-"),
    overallStatus: cleanReportText(record?.overall_status, "未檢查"),
    note: cleanReportText(record?.note),
    updatedAt: cleanReportText(record?.updated_at),
    items
  };
}

export function buildInspectionReportSummary(records, period = "daily") {
  const safeRecords = Array.isArray(records) ? records : [];
  const items = safeRecords.flatMap((record) => record.items.filter((item) => period === "all" || item.period === period));
  const normal = items.filter((item) => item.status === "正常").length;
  const abnormalItems = items.filter((item) => item.status === "異常" || item.status === "待觀察");
  return {
    records: safeRecords.length,
    items: items.length,
    normal,
    abnormal: items.filter((item) => item.status === "異常").length,
    observation: items.filter((item) => item.status === "待觀察").length,
    completionRate: items.length ? Math.round((normal / items.length) * 100) : 0,
    abnormalItems,
    byInspector: countReportRows(safeRecords, "inspector"),
    byStatus: countReportRows(safeRecords, "overallStatus")
  };
}
