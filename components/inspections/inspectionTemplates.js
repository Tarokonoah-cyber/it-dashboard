export const ITEM_STATUSES = ["正常", "異常", "需觀察", "不適用"];

export const HANDLING_STATUSES = ["未處理", "處理中", "已處理", "已通報廠商"];

export const OVERALL_STATUSES = ["正常", "有異常", "需觀察", "已完成"];

export const INSPECTION_TEMPLATE = [
  { category: "網路類", item_name: "防火牆狀態" },
  { category: "網路類", item_name: "核心交換器狀態" },
  { category: "網路類", item_name: "公區 Wi-Fi 狀態" },
  { category: "網路類", item_name: "辦公室網路狀態" },
  { category: "網路類", item_name: "對外網路連線" },
  { category: "Server / NAS 類", item_name: "NAS 狀態" },
  { category: "Server / NAS 類", item_name: "Server 狀態" },
  { category: "Server / NAS 類", item_name: "儲存空間容量" },
  { category: "Server / NAS 類", item_name: "重要系統是否可登入" },
  { category: "備份類", item_name: "NAS 備份是否成功" },
  { category: "備份類", item_name: "Server 備份是否成功" },
  { category: "備份類", item_name: "備份容量是否異常" },
  { category: "機房 / 電力類", item_name: "機房溫度" },
  { category: "機房 / 電力類", item_name: "機房濕度" },
  { category: "機房 / 電力類", item_name: "UPS 狀態" },
  { category: "機房 / 電力類", item_name: "UPS 電量" },
  { category: "監控類", item_name: "NVR 狀態" },
  { category: "監控類", item_name: "攝影機畫面是否正常" },
  { category: "監控類", item_name: "錄影是否正常" }
];

export function createTemplateItems() {
  return INSPECTION_TEMPLATE.map((item) => ({
    ...item,
    status: "正常",
    issue_description: "",
    handling_status: "未處理",
    handling_method: "",
    attachments: [],
    note: ""
  }));
}

export function needsIssueFields(status) {
  return status === "異常" || status === "需觀察";
}

export function calculateInspectionSummary(items = []) {
  const item_count = items.length;
  const normal_count = items.filter((item) => item.status === "正常").length;
  const abnormalItems = items.filter((item) => item.status === "異常");
  const observation_count = items.filter((item) => item.status === "需觀察").length;
  const abnormal_count = abnormalItems.length;

  let overall_status = "正常";
  if (abnormal_count > 0) {
    const allHandled = abnormalItems.every((item) => item.handling_status === "已處理");
    overall_status = allHandled ? "已完成" : "有異常";
  } else if (observation_count > 0) {
    overall_status = "需觀察";
  }

  return {
    item_count,
    normal_count,
    abnormal_count,
    observation_count,
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
