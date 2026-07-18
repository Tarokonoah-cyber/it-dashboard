import "server-only";
import { randomUUID } from "node:crypto";
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

export async function pushLineText(message) {
  const current = config();
  if (!current.token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN 尚未設定");
  if (!current.userId) throw new Error("LINE_PUSH_USER_ID 尚未設定");
  if (!isLineUserId(current.userId)) throw new Error("LINE_PUSH_USER_ID 格式錯誤，必須是以 U 開頭的個人 userId");
  const text = String(message || "").trim().slice(0, 4900);
  if (!text) throw new Error("LINE 推播內容不可空白");

  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${current.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: current.userId,
      messages: [{ type: "text", text }]
    }),
    cache: "no-store"
  });
  const responseText = await response.text();
  if (!response.ok) {
    let detail = responseText;
    try {
      const payload = JSON.parse(responseText);
      const reasons = Array.isArray(payload?.details)
        ? payload.details.map((item) => String(item?.message || item || "").trim()).filter(Boolean)
        : [];
      detail = [payload?.message, ...reasons].filter(Boolean).join("：") || responseText;
    } catch {
      // Keep the original response text.
    }
    const requestId = String(response.headers.get("x-line-request-id") || "").trim();
    const suffix = requestId ? ` (request ${requestId})` : "";
    throw new Error(`LINE API ${response.status}: ${String(detail || "推播失敗").slice(0, 240)}${suffix}`);
  }
  return { status: response.status };
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

async function claimDelivery({ deliveryKey, scheduledDate, kind, itemCounts }) {
  const now = new Date().toISOString();
  const created = await supabaseRequest("line_push_logs", "on_conflict=delivery_key&select=*", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: {
      delivery_key: deliveryKey,
      scheduled_date: scheduledDate,
      kind,
      status: "processing",
      item_counts: itemCounts || {},
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
  const retried = await patchLog(existing.id, { status: "processing", error_message: "", item_counts: itemCounts || {} });
  return { log: retried, claimed: true, reason: "retry" };
}

export async function sendLoggedLineText({ deliveryKey, scheduledDate, kind, message, itemCounts = {} }) {
  const claim = await claimDelivery({ deliveryKey, scheduledDate, kind, itemCounts });
  if (!claim.claimed) return { status: "skipped", reason: claim.reason, log: claim.log };

  try {
    const result = await pushLineText(message);
    const log = await patchLog(claim.log.id, {
      status: "sent",
      response_status: result.status,
      error_message: "",
      sent_at: new Date().toISOString()
    });
    return { status: "sent", log };
  } catch (error) {
    await patchLog(claim.log.id, { status: "failed", error_message: cleanError(error) }).catch((logError) => {
      console.error("[line push log update failed]", logError);
    });
    throw error;
  }
}

export async function getLineReminderStatus() {
  const configuration = getLineConfiguration();
  let lastDelivery = null;
  try {
    const rows = await supabaseRequest("line_push_logs", "select=*&order=created_at.desc&limit=1");
    lastDelivery = rows[0] || null;
  } catch (error) {
    lastDelivery = { status: "unavailable", error_message: cleanError(error) };
  }
  return { ...configuration, lastDelivery };
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
