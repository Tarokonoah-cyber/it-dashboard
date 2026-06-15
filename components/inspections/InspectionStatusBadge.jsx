export default function InspectionStatusBadge({ value, type = "overall" }) {
  const text = value || "未設定";
  const normalized = String(text);
  const tone =
    normalized === "正常" || normalized === "已處理" || normalized === "已完成"
      ? "ok"
      : normalized === "有異常" || normalized === "異常" || normalized === "未處理"
        ? "danger"
        : normalized === "需觀察" || normalized === "處理中" || normalized === "已通報廠商"
          ? "warning"
          : "neutral";

  return <span className={`inspection-status-badge ${type} ${tone}`}>{text}</span>;
}
