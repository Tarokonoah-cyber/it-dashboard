export function dateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function formatDate(value) {
  return dateKey(value) || "-";
}

export function parseDelta(value) {
  const numeric = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) {
    return { text: "0", direction: "flat" };
  }
  return {
    text: `${numeric > 0 ? "+" : "-"}${Math.abs(numeric)}`,
    direction: numeric > 0 ? "up" : "down"
  };
}

export function formatRelativeDate(value) {
  const key = dateKey(value);
  if (!key) return "-";
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} 天前`;
  return key.slice(5).replace("-", "/");
}

export function getLocalDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getTodayKey() {
  const now = new Date();
  return getLocalDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function normalizeTodoPriority(value) {
  const text = String(value || "").trim();
  const key = text.toLowerCase ? text.toLowerCase() : text;
  if (["緊急", "急", "urgent", "critical", "high", "高"].includes(key)) return "urgent";
  if (["重要", "中", "medium"].includes(key)) return "medium";
  return "normal";
}
