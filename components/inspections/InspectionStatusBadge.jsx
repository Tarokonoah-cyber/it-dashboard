import { normalizeInspectionStatus } from "./inspectionTemplates";

export default function InspectionStatusBadge({ value, type = "overall" }) {
  const originalText = value || "未檢查";
  const normalized = normalizeInspectionStatus(originalText);
  const tone =
    normalized === "正常" || normalized === "已完成" || normalized === "已處理"
      ? "ok"
      : normalized === "有異常" || normalized === "異常" || normalized === "未處理"
        ? "danger"
        : normalized === "待觀察" || normalized === "處理中" || normalized === "已通報廠商"
          ? "warning"
          : "neutral";

  return <span className={`inspection-status-badge ${type} ${tone}`}>{normalized}</span>;
}
