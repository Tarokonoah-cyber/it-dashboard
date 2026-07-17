import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createTodoWithWorkLog } from "./dailyOpsSync";
import { supabaseRequest, todayTaipei } from "./supabase-rest";

const TOKEN_TTL_SECONDS = 10 * 60;
const ALLOWED_ACTIONS = new Set(["create_todo", "create_follow_up", "create_calendar_event", "complete_work_item"]);
const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

function signingSecret() {
  const secret = String(process.env.DASHBOARD_SESSION_SECRET || "");
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") return "local-dashboard-assistant-action-secret";
  throw new Error("Dashboard action signing is not configured");
}

function encode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function createToken(action) {
  const payload = encode(JSON.stringify({ action, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) throw new Error("確認內容無效或已遭修改");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!decoded?.exp || decoded.exp <= Math.floor(Date.now() / 1000)) throw new Error("確認內容已過期，請重新提出指令");
  if (!ALLOWED_ACTIONS.has(decoded?.action?.type)) throw new Error("不支援此確認動作");
  return decoded.action;
}

function clean(value, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function normalizeDate(value, fallback = todayTaipei()) {
  const text = clean(value, 60);
  if (!text || text === "今天") return fallback;
  if (text === "明天") return addDays(fallback, 1);
  if (text === "後天") return addDays(fallback, 2);
  if (/下週|下星期/u.test(text)) return addDays(fallback, 7);
  const full = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const short = text.match(/(\d{1,2})[/-](\d{1,2})/);
  if (short) return `${fallback.slice(0, 4)}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  return fallback;
}

function chineseHour(value) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 兩: 2 };
  return map[value] || Number(value) || 0;
}

function normalizeTime(value) {
  const text = clean(value, 60);
  if (!text) return "";
  const colon = text.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  let hour = colon ? Number(colon[1]) : 0;
  let minute = colon ? Number(colon[2]) : 0;
  if (!colon) {
    const hourMatch = text.match(/(\d{1,2}|[一二三四五六七八九十兩])\s*點\s*(\d{1,2})?/u);
    if (!hourMatch) return "";
    hour = chineseHour(hourMatch[1]);
    minute = Number(hourMatch[2] || 0);
  }
  if (/下午|晚上/u.test(text) && hour < 12) hour += 12;
  if (/中午/u.test(text) && hour < 11) hour += 12;
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeWork(row) {
  return {
    ...row,
    title: clean(row?.title || row?.description || row?.subject || row?.content || "未命名工作", 120),
    status: clean(row?.status || "未完成", 40)
  };
}

function normalizeMatch(value) {
  return clean(value, 200).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function workMatches(query, work) {
  const needle = normalizeMatch(query);
  const title = normalizeMatch(work.title);
  if (!needle || !title) return false;
  return title.includes(needle) || needle.includes(title);
}

async function normalizePendingAction(action) {
  if (action.type === "create_todo") {
    const title = clean(action.title, 120);
    if (!title) throw new Error("待辦缺少明確標題");
    return { type: action.type, title, note: clean(action.note), due_date: normalizeDate(action.due_date || action.dateText) };
  }
  if (action.type === "create_follow_up") {
    const title = clean(action.title, 120);
    if (!title) throw new Error("待追蹤事項缺少明確標題");
    return { type: action.type, title, note: clean(action.note), next_follow_date: normalizeDate(action.next_follow_date || action.dateText), current_status: "等待回覆" };
  }
  if (action.type === "create_calendar_event") {
    const title = clean(action.title, 120);
    if (!title) throw new Error("行事曆事件缺少明確標題");
    return { type: action.type, title, note: clean(action.note), event_date: normalizeDate(action.event_date || action.date || action.dateText), event_time: normalizeTime(action.event_time || action.time || action.timeText), event_type: clean(action.event_type || "任務", 40) || "任務" };
  }
  if (action.type === "complete_work_item") {
    const query = clean(action.title || action.query, 120);
    if (!query) throw new Error("請提供要完成的工作標題");
    const rows = await supabaseRequest("work_logs", "select=*&order=date.desc,updated_at.desc,created_at.desc&limit=500");
    const matches = rows.map(normalizeWork).filter((row) => !DONE_STATUSES.has(row.status) && workMatches(query, row));
    if (!matches.length) throw new Error(`找不到明確匹配的工作：${query}`);
    if (matches.length > 1) {
      const error = new Error(`找到 ${matches.length} 筆可能符合的工作，請輸入更完整的標題`);
      error.code = "AMBIGUOUS_WORK";
      error.candidates = matches.slice(0, 5).map((row) => ({ id: row.id, title: row.title }));
      throw error;
    }
    return { type: action.type, id: matches[0].id, title: matches[0].title };
  }
  throw new Error("不支援此動作");
}

function actionLabel(action) {
  if (action.type === "create_todo") return `新增待辦：${action.title}`;
  if (action.type === "create_follow_up") return `新增待追蹤：${action.title}`;
  if (action.type === "create_calendar_event") return `新增行程：${action.event_date}${action.event_time ? ` ${action.event_time}` : ""} ${action.title}`;
  if (action.type === "complete_work_item") return `標記完成：${action.title}`;
  return action.title || "確認動作";
}

export async function prepareAssistantAction(rawAction) {
  const action = await normalizePendingAction(rawAction);
  return {
    type: action.type,
    status: "needs_confirmation",
    title: action.title,
    summary: actionLabel(action),
    token: createToken(action)
  };
}

export async function executeAssistantActionToken(token) {
  const action = verifyToken(token);
  if (action.type === "create_todo") {
    const { todo, workLog } = await createTodoWithWorkLog({ title: action.title, note: action.note, status: "未完成", priority: "中", owner: "共同", due_date: action.due_date }, "vercel-dashboard-bot");
    return { reply: `已新增待辦：${todo.title}`, action: { type: action.type, status: "created", title: todo.title, id: todo.id || null, todo, workLogId: workLog?.id || null } };
  }
  if (action.type === "create_follow_up") {
    const rows = await supabaseRequest("follow_ups", "select=*", { method: "POST", body: { title: action.title, note: action.note || null, next_follow_date: action.next_follow_date, current_status: action.current_status, assignee: "Admin" } });
    const row = rows[0] || action;
    return { reply: `已新增待追蹤：${row.title}`, action: { type: action.type, status: "created", title: row.title, id: row.id || null } };
  }
  if (action.type === "create_calendar_event") {
    const rows = await supabaseRequest("calendar_events", "select=*", { method: "POST", body: { title: action.title, note: action.note || null, event_date: action.event_date, event_time: action.event_time || null, event_type: action.event_type } });
    const row = rows[0] || action;
    return { reply: `已新增行程：${row.title}`, action: { type: action.type, status: "created", title: row.title, id: row.id || null } };
  }
  if (action.type === "complete_work_item") {
    const rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(action.id)}&select=*`, { method: "PATCH", body: { status: "已完成", updated_at: new Date().toISOString() } });
    if (!rows.length) throw new Error("找不到要完成的工作");
    return { reply: `已將工作標記完成：${action.title}`, action: { type: action.type, status: "completed", title: action.title, id: action.id } };
  }
  throw new Error("不支援此動作");
}
