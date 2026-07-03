import { todayTaipei } from "./supabase-rest";

export const FOLLOW_UP_STATUSES = ["等待回覆", "處理中", "待確認", "已完成"];
export const DEFAULT_FOLLOW_UP_STATUS = "等待回覆";
export const DEFAULT_FOLLOW_UP_ASSIGNEE = "Admin";
const MAX_FOLLOW_UP_TITLE_LENGTH = 160;
const MAX_FOLLOW_UP_NOTE_LENGTH = 1000;

function trimText(value) {
  return String(value || "").trim();
}

export function isFollowUpDone(row) {
  return trimText(row?.current_status) === "已完成";
}

export function validateFollowUpText(value, label, maxLength) {
  const text = trimText(value);
  if (text.length > maxLength) {
    const error = new Error(`${label} must be ${maxLength} characters or less`);
    error.name = "ValidationError";
    throw error;
  }
  return text;
}

export function validateFollowUpStatus(value) {
  const status = trimText(value) || DEFAULT_FOLLOW_UP_STATUS;
  if (!FOLLOW_UP_STATUSES.includes(status)) {
    const error = new Error("待追蹤狀態只允許：等待回覆、處理中、待確認、已完成");
    error.name = "ValidationError";
    throw error;
  }
  return status;
}

export function validateFollowUpDate(value) {
  const date = trimText(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("請選擇下次追蹤日");
    error.name = "ValidationError";
    throw error;
  }
  return date;
}

export function normalizeFollowUp(row) {
  const status = validateFollowUpStatus(row?.current_status);
  return {
    ...row,
    title: trimText(row?.title) || "未命名追蹤事項",
    current_status: status,
    next_follow_date: trimText(row?.next_follow_date).slice(0, 10),
    note: trimText(row?.note),
    assignee: trimText(row?.assignee) || DEFAULT_FOLLOW_UP_ASSIGNEE
  };
}

function followUpSortBucket(row, today = todayTaipei()) {
  if (isFollowUpDone(row)) return 3;
  const date = trimText(row?.next_follow_date).slice(0, 10);
  if (date && date < today) return 0;
  if (date === today) return 1;
  return 2;
}

export function sortFollowUps(rows, today = todayTaipei()) {
  return [...(rows || [])].sort((left, right) => {
    const leftBucket = followUpSortBucket(left, today);
    const rightBucket = followUpSortBucket(right, today);
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;
    const leftDate = trimText(left?.next_follow_date).slice(0, 10) || "9999-12-31";
    const rightDate = trimText(right?.next_follow_date).slice(0, 10) || "9999-12-31";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    return String(right?.created_at || "").localeCompare(String(left?.created_at || ""));
  });
}

export function buildFollowUpPayload(body, defaults = {}) {
  const title = validateFollowUpText(body?.title ?? defaults.title, "追蹤事項", MAX_FOLLOW_UP_TITLE_LENGTH);
  if (!title) {
    const error = new Error("請輸入追蹤事項");
    error.name = "ValidationError";
    throw error;
  }

  const status = validateFollowUpStatus(body?.current_status ?? defaults.current_status);
  const nextFollowDate = validateFollowUpDate(body?.next_follow_date ?? defaults.next_follow_date);
  const note = validateFollowUpText(body?.note ?? defaults.note, "備註", MAX_FOLLOW_UP_NOTE_LENGTH);
  const assignee = trimText(body?.assignee ?? defaults.assignee) || DEFAULT_FOLLOW_UP_ASSIGNEE;
  const now = new Date().toISOString();

  return {
    title,
    current_status: status,
    next_follow_date: nextFollowDate,
    note,
    assignee,
    source_todo_id: trimText(body?.source_todo_id ?? defaults.source_todo_id) || null,
    updated_at: now,
    ...(status === "已完成" ? { completed_at: now } : { completed_at: null })
  };
}
