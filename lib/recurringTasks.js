export const RECURRENCE_KINDS = ["daily", "weekdays", "weekly", "monthly"];
export const RECURRING_PRIORITIES = ["一般", "重要"];
export const ISO_WEEKDAYS = [
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" },
  { value: 7, label: "星期日" }
];

function validationError(message) {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

function text(value, maxLength, label) {
  const result = String(value || "").trim();
  if (result.length > maxLength) throw validationError(`${label}不可超過 ${maxLength} 字`);
  return result;
}

export function toDateKey(value) {
  return String(value || "").slice(0, 10);
}

export function isValidDateKey(value) {
  const key = toDateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

export function addDateDays(value, amount) {
  if (!isValidDateKey(value)) return "";
  const date = new Date(`${toDateKey(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
}

export function isoWeekday(value) {
  if (!isValidDateKey(value)) return 0;
  return new Date(`${toDateKey(value)}T00:00:00Z`).getUTCDay() || 7;
}

function daysInMonth(value) {
  const key = toDateKey(value);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isRecurringTaskDue(template, date) {
  const key = toDateKey(date);
  if (!isValidDateKey(key) || !template || template.archived_at || template.is_active === false) return false;
  const startDate = toDateKey(template.start_date);
  const endDate = toDateKey(template.end_date);
  if (startDate && key < startDate) return false;
  if (endDate && key > endDate) return false;

  const weekday = isoWeekday(key);
  if (template.recurrence_kind === "daily") return true;
  if (template.recurrence_kind === "weekdays") return weekday >= 1 && weekday <= 5;
  if (template.recurrence_kind === "weekly") return weekday === Number(template.weekday);
  if (template.recurrence_kind === "monthly") {
    const targetDay = Math.min(Number(template.day_of_month), daysInMonth(key));
    return Number(key.slice(8, 10)) === targetDay;
  }
  return false;
}

export function getRecurringEvaluationDates(template, today, maxDays = 31) {
  const todayKey = toDateKey(today);
  if (!isValidDateKey(todayKey) || !template || template.archived_at || template.is_active === false) return [];
  const oldestAllowed = addDateDays(todayKey, -(Math.max(1, Number(maxDays) || 31) - 1));
  const lastChecked = toDateKey(template.last_checked_date);
  let cursor = lastChecked && isValidDateKey(lastChecked)
    ? addDateDays(lastChecked, 1)
    : todayKey;
  const startDate = toDateKey(template.start_date);
  if (startDate && cursor < startDate) cursor = startDate;
  if (cursor < oldestAllowed) cursor = oldestAllowed;
  const endDate = toDateKey(template.end_date);
  const lastDate = endDate && endDate < todayKey ? endDate : todayKey;
  const dates = [];
  while (cursor && cursor <= lastDate) {
    if (isRecurringTaskDue(template, cursor)) dates.push(cursor);
    cursor = addDateDays(cursor, 1);
  }
  return dates;
}

export function normalizeRecurringTask(row) {
  return {
    ...row,
    title: String(row?.title || "").trim(),
    note: String(row?.note || "").trim(),
    owner: String(row?.owner || "共同").trim() || "共同",
    priority: RECURRING_PRIORITIES.includes(row?.priority) ? row.priority : "一般",
    recurrence_kind: RECURRENCE_KINDS.includes(row?.recurrence_kind) ? row.recurrence_kind : "daily",
    weekday: row?.weekday === null || row?.weekday === undefined ? null : Number(row.weekday),
    day_of_month: row?.day_of_month === null || row?.day_of_month === undefined ? null : Number(row.day_of_month),
    start_date: toDateKey(row?.start_date),
    end_date: toDateKey(row?.end_date),
    last_checked_date: toDateKey(row?.last_checked_date),
    is_active: row?.is_active !== false
  };
}

export function buildRecurringTaskPayload(body, { current = {}, today = "" } = {}) {
  const merged = { ...current, ...(body || {}) };
  const title = text(merged.title, 120, "工作名稱");
  if (!title) throw validationError("請輸入工作名稱");
  const note = text(merged.note, 1000, "備註");
  const owner = text(merged.owner || "共同", 120, "負責人") || "共同";
  const priority = String(merged.priority || "一般").trim();
  if (!RECURRING_PRIORITIES.includes(priority)) throw validationError("優先級只允許一般或重要");
  const recurrenceKind = String(merged.recurrence_kind || "daily").trim();
  if (!RECURRENCE_KINDS.includes(recurrenceKind)) throw validationError("不支援此週期規則");
  const startDate = toDateKey(merged.start_date || today);
  const endDate = toDateKey(merged.end_date);
  if (!isValidDateKey(startDate)) throw validationError("請選擇開始日期");
  if (endDate && !isValidDateKey(endDate)) throw validationError("結束日期格式不正確");
  if (endDate && endDate < startDate) throw validationError("結束日期不可早於開始日期");

  let weekday = null;
  let dayOfMonth = null;
  if (recurrenceKind === "weekly") {
    weekday = Number(merged.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw validationError("請選擇每週執行日");
  }
  if (recurrenceKind === "monthly") {
    dayOfMonth = Number(merged.day_of_month);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw validationError("每月日期必須介於 1 到 31");
  }

  return {
    title,
    note,
    owner,
    priority,
    recurrence_kind: recurrenceKind,
    weekday,
    day_of_month: dayOfMonth,
    start_date: startDate,
    end_date: endDate || null,
    is_active: merged.is_active !== false
  };
}

export function formatRecurrence(template) {
  if (template?.recurrence_kind === "daily") return "每天";
  if (template?.recurrence_kind === "weekdays") return "每週一至週五";
  if (template?.recurrence_kind === "weekly") return `每週${ISO_WEEKDAYS.find((item) => item.value === Number(template.weekday))?.label.replace("星期", "週") || ""}`;
  if (template?.recurrence_kind === "monthly") return `每月 ${Number(template.day_of_month)} 日`;
  return "未設定";
}
