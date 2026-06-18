export const ITEM_STATUSES = ["正常", "異常", "待觀察", "未檢查"];

export const HANDLING_STATUSES = ["未處理", "處理中", "已處理", "已通報廠商"];

export const OVERALL_STATUSES = ["正常", "有異常", "待觀察", "已完成", "未檢查"];

export const LEGACY_STATUS_MAP = {
  需觀察: "待觀察",
  不適用: "未檢查"
};

export const INSPECTION_TEMPLATE = [
  { category: "環境", item_name: "機房溫度" },
  { category: "網路設備", item_name: "防火牆狀態" },
  { category: "網路設備", item_name: "Wi-Fi 狀態" },
  { category: "客房服務", item_name: "串流測試" },
  { category: "備份與儲存", item_name: "NAS / 備份" },
  { category: "備份與儲存", item_name: "德安備份" },
  { category: "核心系統", item_name: "OPERA 備份" }
];

export function normalizeInspectionStatus(status) {
  const text = String(status || "").trim();
  return LEGACY_STATUS_MAP[text] || text || "未檢查";
}

export function createTemplateItems() {
  return INSPECTION_TEMPLATE.map((item) => ({
    ...item,
    status: "未檢查",
    issue_description: "",
    handling_status: "未處理",
    handling_method: "",
    attachments: [],
    note: ""
  }));
}

export function needsIssueFields(status) {
  const normalized = normalizeInspectionStatus(status);
  return normalized === "異常" || normalized === "待觀察";
}

export function calculateInspectionSummary(items = []) {
  const item_count = items.length;
  const normal_count = items.filter((item) => normalizeInspectionStatus(item.status) === "正常").length;
  const abnormalItems = items.filter((item) => normalizeInspectionStatus(item.status) === "異常");
  const observation_count = items.filter((item) => normalizeInspectionStatus(item.status) === "待觀察").length;
  const unchecked_count = items.filter((item) => normalizeInspectionStatus(item.status) === "未檢查").length;
  const abnormal_count = abnormalItems.length;

  let overall_status = "正常";
  if (abnormal_count > 0) {
    const allHandled = abnormalItems.every((item) => item.handling_status === "已處理");
    overall_status = allHandled ? "已完成" : "有異常";
  } else if (observation_count > 0) {
    overall_status = "待觀察";
  } else if (unchecked_count > 0) {
    overall_status = "未檢查";
  }

  return {
    item_count,
    normal_count,
    abnormal_count,
    observation_count,
    unchecked_count,
    overall_status
  };
}

export function faultRecordDraftFromInspectionItem(record, item) {
  return {
    source: "每日巡檢",
    discovered_date: record?.inspection_date || "",
    category: item?.category || "",
    title: item?.item_name || "",
    description: item?.issue_description || "",
    handling_method: item?.handling_method || "",
    attachments: item?.attachments || []
  };
}
