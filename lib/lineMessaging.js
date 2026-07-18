import "server-only";
import { randomUUID } from "node:crypto";
import { sendLinePushRequest } from "./lineTransport";
import { supabaseRequest, todayTaipei } from "./supabase-rest";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function config() {
  return {
    token: String(process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim(),
    userId: String(process.env.LINE_PUSH_USER_ID || "").trim()
  };
}

function isLineUserId(value) {
  return /^U[0-9a-f]{32}$/i.test(String(value || "").trim());
}

function cleanError(error) {
  return String(error?.message || error || "LINE 推播失敗")
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

export function getLineConfiguration() {
  const current = config();
  return {
    configured: Boolean(current.token && isLineUserId(current.userId)),
    tokenConfigured: Boolean(current.token),
    userConfigured: isLineUserId(current.userId)
  };
}

function requireLineConfiguration() {
  const current = config();
  if (!current.token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN 尚未設定");
  if (!current.userId) throw new Error("LINE_PUSH_USER_ID 尚未設定");
  if (!isLineUserId(current.userId)) throw new Error("LINE_PUSH_USER_ID 格式錯誤，必須是以 U 開頭的個人 userId");
  return current;
}

export async function pushLineMessages(messages, options = {}) {
  const current = requireLineConfiguration();
  if (!Array.isArray(messages) || !messages.length) throw new Error("LINE 推播內容不可空白");
  if (messages.length > 5) throw new Error("LINE 單次最多推播 5 則訊息");
  const validMessages = messages.filter((message) => message && typeof message === "object" && message.type);
  if (validMessages.length !== messages.length) throw new Error("LINE 推播訊息格式錯誤");

  const retryKey = String(options.retryKey || randomUUID()).trim();
  const fetchImpl = options.fetchImpl || fetch;
  return sendLinePushRequest({
    url: LINE_PUSH_URL,
    token: current.token,
    userId: current.userId,
    messages: validMessages,
    retryKey,
    fetchImpl
  });
}

export async function pushLineText(message, options = {}) {
  const text = String(message || "").trim().slice(0, 4900);
  if (!text) throw new Error("LINE 推播內容不可空白");
  return pushLineMessages([{ type: "text", text }], options);
}

async function getLog(deliveryKey) {
  const rows = await supabaseRequest(
    "line_push_logs",
    `select=*&delivery_key=eq.${encodeURIComponent(deliveryKey)}&limit=1`
  );
  return rows[0] || null;
}

async function patchLog(id, payload) {
  const rows = await supabaseRequest("line_push_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    body: { ...payload, updated_at: new Date().toISOString() }
  });
  return rows[0] || { id, ...payload };
}

async function claimDelivery({ deliveryKey, scheduledDate, kind, itemCounts, notificationKeys }) {
  const now = new Date().toISOString();
  const retryKey = randomUUID();
  const created = await supabaseRequest("line_push_logs", "on_conflict=delivery_key&select=*", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: {
      delivery_key: deliveryKey,
      scheduled_date: scheduledDate,
      kind,
      status: "processing",
      item_counts: itemCounts || {},
      notification_keys: notificationKeys || [],
      retry_key: retryKey,
      created_at: now,
      updated_at: now
    }
  });
  if (created[0]) return { log: created[0], claimed: true };

  const existing = await getLog(deliveryKey);
  if (!existing) throw new Error("無法建立 LINE 推播紀錄");
  if (existing.status === "sent") return { log: existing, claimed: false, reason: "already_sent" };
  const age = Date.now() - new Date(existing.updated_at || existing.created_at || 0).getTime();
  if (existing.status === "processing" && age < 15 * 60 * 1000) {
    return { log: existing, claimed: false, reason: "already_processing" };
  }
  const retried = await patchLog(existing.id, {
    status: "processing",
    error_message: "",
    item_counts: itemCounts || {},
    notification_keys: notificationKeys || [],
    retry_key: existing.retry_key || retryKey
  });
  return { log: retried, claimed: true, reason: "retry" };
}

export async function sendLoggedLineMessages({
  deliveryKey,
  scheduledDate,
  kind,
  messages,
  itemCounts = {},
  notificationKeys = []
}) {
  const keys = [...new Set((notificationKeys || []).map(String).filter(Boolean))].slice(0, 500);
  const claim = await claimDelivery({ deliveryKey, scheduledDate, kind, itemCounts, notificationKeys: keys });
  if (!claim.claimed) return { status: "skipped", reason: claim.reason, log: claim.log };

  try {
    const result = await pushLineMessages(messages, { retryKey: claim.log.retry_key });
    const log = await patchLog(claim.log.id, {
      status: "sent",
      response_status: result.status,
      request_id: result.requestId || null,
      accepted_request_id: result.acceptedRequestId || null,
      error_message: "",
      sent_at: new Date().toISOString()
    });
    return { status: "sent", log };
  } catch (error) {
    await patchLog(claim.log.id, {
      status: "failed",
      response_status: Number(error?.status) || null,
      request_id: error?.requestId || null,
      error_message: cleanError(error)
    }).catch((logError) => {
      console.error("[line push log update failed]", logError);
    });
    throw error;
  }
}

export async function sendLoggedLineText({ deliveryKey, scheduledDate, kind, message, itemCounts = {}, notificationKeys = [] }) {
  const text = String(message || "").trim().slice(0, 4900);
  if (!text) throw new Error("LINE 推播內容不可空白");
  return sendLoggedLineMessages({
    deliveryKey,
    scheduledDate,
    kind,
    messages: [{ type: "text", text }],
    itemCounts,
    notificationKeys
  });
}

export async function getLineReminderStatus() {
  const configuration = getLineConfiguration();
  let lastDelivery = null;
  let deliveries = {};
  try {
    const rows = await supabaseRequest("line_push_logs", "select=*&order=created_at.desc&limit=100");
    lastDelivery = rows[0] || null;
    for (const kind of ["daily_digest", "critical_event", "critical_follow_up"]) {
      deliveries[kind] = rows.find((row) => row.kind === kind) || null;
    }
  } catch (error) {
    lastDelivery = { status: "unavailable", error_message: cleanError(error) };
    deliveries = {
      daily_digest: lastDelivery,
      critical_event: lastDelivery,
      critical_follow_up: lastDelivery
    };
  }
  return { ...configuration, lastDelivery, deliveries };
}

export async function sendLineTestMessage() {
  const today = todayTaipei();
  return sendLoggedLineText({
    deliveryKey: `test:${randomUUID()}`,
    scheduledDate: today,
    kind: "test",
    message: `【測試】資訊管理平台 LINE 提醒連線成功\n時間：${new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date())}`,
    itemCounts: {}
  });
}
