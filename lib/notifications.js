import { addDateDays, isRecurringTaskDue, toDateKey } from "./recurringTasks";

export const NOTIFICATION_CATEGORIES = {
  overdue_work: { label: "逾期工作", icon: "!", href: "/work" },
  expiring_contract: { label: "合約到期", icon: "◇", href: "/contracts" },
  inspection_issue: { label: "巡檢異常", icon: "☑", href: "/inspections" },
  due_follow_up: { label: "待追蹤", icon: "↗", href: "/follow-ups" },
  recurring_task: { label: "週期任務", icon: "↻", href: "/work/recurring" }
};

const CLOSED_CONTRACT_PATTERN = /已續約|已終止|無合約|取消|關閉|closed|cancel/i;
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const DONE_STATUSES = new Set(["已完成", "完成", "done", "closed", "取消", "cancel", "cancelled", "canceled"]);
const HANDLED_STATUSES = new Set(["已處理", "已完成", "完成", "done", "closed"]);

function text(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function normalizedStatus(value) {
  return text(value).toLowerCase();
}

function isDoneStatus(value) {
  return DONE_STATUSES.has(normalizedStatus(value));
}

function isHandledStatus(value) {
  return HANDLED_STATUSES.has(normalizedStatus(value));
}

function dateKey(value) {
  const key = toDateKey(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function notification({ sourceType, sourceId, title, description, dueDate, severity, href, updatedAt }) {
  const meta = NOTIFICATION_CATEGORIES[sourceType];
  const id = text(sourceId);
  if (!meta || !id) return null;
  return {
    key: `${sourceType}:${id}`,
    source_type: sourceType,
    source_id: id,
    category_label: meta.label,
    icon: meta.icon,
    title: text(title, meta.label),
    description: text(description),
    due_date: dateKey(dueDate),
    severity: SEVERITY_ORDER[severity] === undefined ? "medium" : severity,
    href: href || meta.href,
    source_updated_at: updatedAt || null
  };
}

function workNotifications(rows, today) {
  return (rows || []).flatMap((row) => {
    const dueDate = dateKey(row.date);
    if (!dueDate || dueDate >= today || isDoneStatus(row.status)) return [];
    const title = text(row.title, "未命名工作");
    const item = notification({
      sourceType: "overdue_work",
      sourceId: row.id,
      title: `工作已逾期：${title}`,
      description: [`原定 ${dueDate}`, text(row.staff), text(row.category)].filter(Boolean).join(" · "),
      dueDate,
      severity: daysBetween(dueDate, today) >= 7 ? "critical" : "high",
      href: `/work?q=${encodeURIComponent(title)}`,
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function contractNotifications(contracts, mobileContracts, today) {
  const lastDate = addDateDays(today, 30);
  const rows = [
    ...(contracts || []).map((row) => ({
      ...row,
      source_kind: "software",
      display_name: text(row.contract_name || row.vendor, "未命名合約"),
      href: "/contracts/software"
    })),
    ...(mobileContracts || []).map((row) => ({
      ...row,
      source_kind: "mobile",
      display_name: [text(row.phone_no), text(row.user_name)].filter(Boolean).join(" ") || "手機門號合約",
      href: "/contracts/mobile"
    }))
  ];
  return rows.flatMap((row) => {
    const endDate = dateKey(row.end_date || row.expire_date);
    if (!endDate || endDate > lastDate || CLOSED_CONTRACT_PATTERN.test(text(row.status))) return [];
    const remaining = daysBetween(today, endDate);
    const item = notification({
      sourceType: "expiring_contract",
      sourceId: `${row.source_kind}:${row.id}`,
      title: remaining < 0 ? `合約已到期：${row.display_name}` : `合約即將到期：${row.display_name}`,
      description: remaining < 0 ? `已逾期 ${Math.abs(remaining)} 天` : remaining === 0 ? "今天到期" : `剩餘 ${remaining} 天`,
      dueDate: endDate,
      severity: remaining <= 0 ? "critical" : remaining <= 7 ? "high" : "medium",
      href: row.href,
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function inspectionNotifications(items, records) {
  const recordsById = new Map((records || []).map((row) => [String(row.id), row]));
  return (items || []).flatMap((row) => {
    if (text(row.status, "正常") === "正常" || isHandledStatus(row.handling_status)) return [];
    const record = recordsById.get(String(row.inspection_record_id)) || {};
    const inspectionDate = dateKey(record.inspection_date);
    const item = notification({
      sourceType: "inspection_issue",
      sourceId: row.id,
      title: `巡檢${text(row.status, "異常")}：${text(row.item_name, "未命名項目")}`,
      description: [inspectionDate, text(row.issue_description, "尚未填寫異常說明"), text(row.handling_status, "未處理")].filter(Boolean).join(" · "),
      dueDate: inspectionDate,
      severity: text(row.status).includes("異常") ? "critical" : "high",
      href: record.id ? `/inspections/${record.id}` : "/inspections",
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function followUpNotifications(rows, today) {
  return (rows || []).flatMap((row) => {
    const dueDate = dateKey(row.next_follow_date);
    if (!dueDate || dueDate > today || isDoneStatus(row.current_status)) return [];
    const title = text(row.title, "未命名待追蹤");
    const item = notification({
      sourceType: "due_follow_up",
      sourceId: row.id,
      title: dueDate < today ? `追蹤已逾期：${title}` : `今天需追蹤：${title}`,
      description: [text(row.current_status), text(row.assignee)].filter(Boolean).join(" · "),
      dueDate,
      severity: dueDate < today ? "high" : "medium",
      href: `/follow-ups?q=${encodeURIComponent(title)}`,
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function recurringNotifications(templates, occurrences, today) {
  const occurrenceByTemplate = new Map((occurrences || []).map((row) => [String(row.template_id), row]));
  return (templates || []).flatMap((template) => {
    if (!isRecurringTaskDue(template, today)) return [];
    const occurrence = occurrenceByTemplate.get(String(template.id));
    if (occurrence?.status === "generated") return [];
    const failed = occurrence?.status === "failed";
    const item = notification({
      sourceType: "recurring_task",
      sourceId: `${template.id}:${today}`,
      title: failed ? `週期任務產生失敗：${text(template.title)}` : `今日週期任務待產生：${text(template.title)}`,
      description: failed ? text(occurrence.error_message, "請重新執行週期任務") : [text(template.owner), text(template.priority)].filter(Boolean).join(" · "),
      dueDate: today,
      severity: failed ? "critical" : "medium",
      href: "/work/recurring",
      updatedAt: occurrence?.updated_at || template.updated_at
    });
    return item ? [item] : [];
  });
}

export function buildNotificationItems({
  today,
  workLogs = [],
  contracts = [],
  mobileContracts = [],
  inspectionItems = [],
  inspectionRecords = [],
  followUps = [],
  recurringTemplates = [],
  recurringOccurrences = []
}) {
  const items = [
    ...workNotifications(workLogs, today),
    ...contractNotifications(contracts, mobileContracts, today),
    ...inspectionNotifications(inspectionItems, inspectionRecords),
    ...followUpNotifications(followUps, today),
    ...recurringNotifications(recurringTemplates, recurringOccurrences, today)
  ];
  return items.sort((left, right) => {
    const severity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severity) return severity;
    return (left.due_date || "9999-12-31").localeCompare(right.due_date || "9999-12-31");
  });
}

export function applyNotificationStates(items, states, now = new Date().toISOString()) {
  const stateByKey = new Map((states || []).map((row) => [String(row.notification_key), row]));
  return (items || []).map((item) => {
    const state = stateByKey.get(item.key) || {};
    const snoozedUntil = state.snoozed_until || null;
    return {
      ...item,
      read_at: state.read_at || null,
      snoozed_until: snoozedUntil,
      line_pushed_at: state.line_pushed_at || null,
      is_read: Boolean(state.read_at),
      is_snoozed: Boolean(snoozedUntil && snoozedUntil > now)
    };
  });
}

export function summarizeNotifications(items) {
  const summary = { total: items.length, unread: 0, snoozed: 0, critical: 0, categories: {} };
  Object.keys(NOTIFICATION_CATEGORIES).forEach((key) => { summary.categories[key] = 0; });
  items.forEach((item) => {
    if (item.is_snoozed) summary.snoozed += 1;
    if (!item.is_read && !item.is_snoozed) summary.unread += 1;
    if (item.severity === "critical" && !item.is_snoozed) summary.critical += 1;
    summary.categories[item.source_type] = (summary.categories[item.source_type] || 0) + 1;
  });
  return summary;
}

export function validateNotificationKey(value) {
  const key = text(value);
  if (!key || key.length > 240 || !key.includes(":")) {
    const error = new Error("通知識別碼無效");
    error.name = "ValidationError";
    throw error;
  }
  return key;
}

export function validateSnoozeUntil(value, now = Date.now()) {
  const date = new Date(value);
  const max = now + 366 * 86400000;
  if (Number.isNaN(date.getTime()) || date.getTime() <= now || date.getTime() > max) {
    const error = new Error("延後提醒時間必須介於現在至一年內");
    error.name = "ValidationError";
    throw error;
  }
  return date.toISOString();
}

function oneLine(value, limit = 72) {
  const result = text(value).replace(/\s+/g, " ");
  return result.length > limit ? `${result.slice(0, limit - 1)}…` : result;
}

export function buildNotificationLineMessage(items, today, appUrl = "") {
  const visible = (items || []).slice(0, 20);
  const lines = [`資訊管理平台通知｜${today}`, `共 ${items.length} 件待注意事項`];
  visible.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.category_label}] ${oneLine(item.title)}${item.due_date ? `（${item.due_date}）` : ""}`);
  });
  if (items.length > visible.length) lines.push(`另有 ${items.length - visible.length} 件，請至通知中心查看。`);
  if (appUrl) lines.push(String(appUrl).replace(/\/+$/, "") + "/notifications");
  const result = lines.join("\n");
  return result.length > 4900 ? `${result.slice(0, 4899)}…` : result;
}
