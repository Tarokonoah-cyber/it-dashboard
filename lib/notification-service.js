import "server-only";
import { randomUUID } from "node:crypto";
import { getLineConfiguration, sendLoggedLineMessages } from "./lineMessaging";
import {
  NOTIFICATION_CATEGORIES,
  applyNotificationStates,
  buildNotificationItems,
  buildNotificationLineFlexMessage,
  summarizeNotifications,
  validateNotificationKey,
  validateSnoozeUntil
} from "./notifications";
import { supabaseRequest, todayTaipei } from "./supabase-rest";

export function getNotificationAppUrl() {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (!configured) return "";
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}

async function loadInspectionSources() {
  const items = await supabaseRequest(
    "inspection_record_items",
    `select=id,inspection_record_id,item_name,status,issue_description,handling_status,updated_at&status=neq.${encodeURIComponent("正常")}&order=updated_at.desc&limit=300`
  );
  if (!items.length) return { items: [], records: [] };
  const ids = [...new Set(items.map((row) => String(row.inspection_record_id)).filter(Boolean))];
  const encodedIds = ids.map(encodeURIComponent).join(",");
  const records = await supabaseRequest(
    "inspection_records",
    `select=id,inspection_date,updated_at&id=in.(${encodedIds})&limit=300`
  );
  return { items, records };
}

async function loadSources(today) {
  const [workLogs, contracts, mobileContracts, inspections, followUps, recurringTemplates, recurringOccurrences, states] = await Promise.all([
    supabaseRequest(
      "work_logs",
      `select=id,date,staff,title,category,status,updated_at&date=lt.${encodeURIComponent(today)}&order=date.asc&limit=1000`
    ),
    supabaseRequest("contracts", "select=id,contract_name,vendor,end_date,status,updated_at&limit=1000"),
    supabaseRequest("mobile_contracts", "select=id,phone_no,user_name,end_date,status,updated_at&limit=1000"),
    loadInspectionSources(),
    supabaseRequest(
      "follow_ups",
      `select=id,title,current_status,next_follow_date,assignee,updated_at&next_follow_date=lte.${encodeURIComponent(today)}&order=next_follow_date.asc&limit=500`
    ),
    supabaseRequest(
      "recurring_task_templates",
      "select=*&is_active=eq.true&archived_at=is.null&order=created_at.asc&limit=500"
    ),
    supabaseRequest(
      "recurring_task_occurrences",
      `select=*&occurrence_date=eq.${encodeURIComponent(today)}&limit=500`
    ),
    supabaseRequest("notification_states", "select=*&order=updated_at.desc&limit=3000")
  ]);
  return {
    workLogs,
    contracts,
    mobileContracts,
    inspectionItems: inspections.items,
    inspectionRecords: inspections.records,
    followUps,
    recurringTemplates,
    recurringOccurrences,
    states
  };
}

export async function loadNotificationSnapshot(today = todayTaipei()) {
  const sources = await loadSources(today);
  const items = applyNotificationStates(buildNotificationItems({ today, ...sources }), sources.states);
  return {
    today,
    generated_at: new Date().toISOString(),
    items,
    summary: summarizeNotifications(items),
    categories: Object.entries(NOTIFICATION_CATEGORIES).map(([key, value]) => ({ key, ...value })),
    line: getLineConfiguration()
  };
}

function stateBody(item, changes = {}) {
  return {
    notification_key: item.key,
    source_type: item.source_type,
    source_id: item.source_id,
    read_at: changes.read_at === undefined ? item.read_at : changes.read_at,
    snoozed_until: changes.snoozed_until === undefined ? item.snoozed_until : changes.snoozed_until,
    line_pushed_at: changes.line_pushed_at === undefined ? item.line_pushed_at : changes.line_pushed_at,
    updated_at: new Date().toISOString()
  };
}

async function upsertStates(items, changes = {}) {
  if (!items.length) return [];
  return supabaseRequest("notification_states", "on_conflict=notification_key&select=*", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: items.map((item) => stateBody(item, typeof changes === "function" ? changes(item) : changes))
  });
}

export async function markNotificationsLinePushed(items, pushedAt = new Date().toISOString()) {
  if (!items.length) return [];
  const updatedAt = new Date().toISOString();
  return supabaseRequest("notification_states", "on_conflict=notification_key&select=*", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: items.map((item) => ({
      notification_key: item.key,
      source_type: item.source_type,
      source_id: item.source_id,
      line_pushed_at: pushedAt,
      updated_at: updatedAt
    }))
  });
}

export async function changeNotificationState(body) {
  const action = String(body?.action || "").trim();
  const snapshot = await loadNotificationSnapshot();
  if (action === "read_all") {
    await upsertStates(snapshot.items.filter((item) => !item.is_read), { read_at: new Date().toISOString() });
    return loadNotificationSnapshot();
  }

  const key = validateNotificationKey(body?.key);
  const item = snapshot.items.find((row) => row.key === key);
  if (!item) {
    const error = new Error("這則通知已不存在或事項已完成");
    error.name = "NotFoundError";
    throw error;
  }

  let changes;
  if (action === "read") changes = { read_at: new Date().toISOString() };
  else if (action === "unread") changes = { read_at: null };
  else if (action === "snooze") changes = { snoozed_until: validateSnoozeUntil(body?.snoozed_until) };
  else if (action === "unsnooze") changes = { snoozed_until: null };
  else {
    const error = new Error("不支援的通知操作");
    error.name = "ValidationError";
    throw error;
  }
  await upsertStates([item], changes);
  return loadNotificationSnapshot();
}

export async function pushNotificationsToLine(body) {
  const snapshot = await loadNotificationSnapshot();
  const requestedKeys = Array.isArray(body?.keys) ? [...new Set(body.keys.map(validateNotificationKey))] : [];
  const items = requestedKeys.length
    ? requestedKeys.map((key) => snapshot.items.find((item) => item.key === key)).filter(Boolean)
    : snapshot.items.filter((item) => !item.is_read && !item.is_snoozed);
  if (!items.length) {
    const error = new Error("目前沒有可推播的通知");
    error.name = "ValidationError";
    throw error;
  }
  if (items.length > 50) {
    const error = new Error("單次最多推播 50 則通知");
    error.name = "ValidationError";
    throw error;
  }

  const deliveryId = randomUUID();
  const delivery = await sendLoggedLineMessages({
    deliveryKey: `manual:${deliveryId}`,
    scheduledDate: snapshot.today,
    kind: "manual",
    messages: [buildNotificationLineFlexMessage(items, snapshot.today, getNotificationAppUrl(), { mode: "manual" })],
    itemCounts: summarizeNotifications(items),
    notificationKeys: items.map((item) => item.key)
  });
  await upsertStates(items, { line_pushed_at: new Date().toISOString() });
  return {
    delivery_id: delivery.log?.id || deliveryId,
    pushed: items.length,
    snapshot: await loadNotificationSnapshot()
  };
}
