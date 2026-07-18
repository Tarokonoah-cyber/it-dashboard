import "server-only";
import { createHash } from "node:crypto";
import { sendLoggedLineMessages } from "./lineMessaging";
import {
  excludeRecentlyPushedItems,
  isTaipeiBusinessTime,
  isWeekdayDateKey,
  notificationItemCounts,
  selectActiveNotificationItems,
  selectNewCriticalItems,
  taipeiDateTimeParts
} from "./lineNotificationPolicy";
import {
  getNotificationAppUrl,
  loadNotificationSnapshot,
  markNotificationsLinePushed
} from "./notification-service";
import { buildNotificationItems, buildNotificationLineFlexMessage } from "./notifications";
import { supabaseRequest, todayTaipei } from "./supabase-rest";

const RECENT_PUSH_WINDOW_MS = 4 * 60 * 60 * 1000;

function calendarNotification(event, today) {
  const eventTime = String(event.event_time || "").trim().slice(0, 5);
  const eventType = String(event.event_type || "").trim();
  return {
    key: `today_event:${event.id}`,
    source_type: "today_event",
    source_id: String(event.id),
    category_label: "今日行程",
    icon: "▣",
    title: String(event.title || "未命名行程").trim(),
    description: [eventTime, eventType].filter(Boolean).join(" · "),
    due_date: today,
    event_time: eventTime,
    severity: "low",
    href: "/calendar",
    source_updated_at: event.updated_at || null
  };
}

async function loadTodayCalendar(today) {
  const rows = await supabaseRequest(
    "calendar_events",
    `select=id,title,event_date,event_time,event_type,updated_at&event_date=eq.${encodeURIComponent(today)}&order=event_time.asc.nullsfirst,created_at.asc&limit=200`
  );
  return rows.map((event) => calendarNotification(event, today));
}

async function loadRecentNotificationKeys(now, kinds = []) {
  const since = new Date(now.getTime() - RECENT_PUSH_WINDOW_MS).toISOString();
  const filters = [
    "select=notification_keys",
    "status=eq.sent",
    `created_at=gte.${encodeURIComponent(since)}`,
    "order=created_at.desc",
    "limit=200"
  ];
  if (kinds.length) filters.push(`kind=in.(${kinds.map(encodeURIComponent).join(",")})`);
  const rows = await supabaseRequest("line_push_logs", filters.join("&"));
  return new Set(rows.flatMap((row) => Array.isArray(row.notification_keys) ? row.notification_keys.map(String) : []));
}

function notificationKeys(items) {
  return items.filter((item) => item.source_type !== "today_event").map((item) => item.key);
}

export async function runDailyLineDigest(today = todayTaipei(), now = new Date()) {
  if (!isWeekdayDateKey(today)) return { status: "skipped", reason: "weekend", counts: {} };
  const [snapshot, calendarItems, recentKeys] = await Promise.all([
    loadNotificationSnapshot(today),
    loadTodayCalendar(today),
    loadRecentNotificationKeys(now, ["critical_event"])
  ]);
  const activeNotifications = selectActiveNotificationItems(snapshot.items);
  const displayNotifications = excludeRecentlyPushedItems(activeNotifications, recentKeys);
  const summaryItems = [...activeNotifications, ...calendarItems];
  const displayItems = [...displayNotifications, ...calendarItems];
  const recentCount = activeNotifications.length - displayNotifications.length;
  const counts = notificationItemCounts(summaryItems);
  const message = buildNotificationLineFlexMessage(displayItems, today, getNotificationAppUrl(), {
    mode: "daily_digest",
    summaryItems,
    recentCount
  });
  const delivery = await sendLoggedLineMessages({
    deliveryKey: `daily_digest:${today}`,
    scheduledDate: today,
    kind: "daily_digest",
    messages: [message],
    itemCounts: counts,
    notificationKeys: notificationKeys(summaryItems)
  });
  if (delivery.status === "sent") await markNotificationsLinePushed(activeNotifications);
  return { status: delivery.status, reason: delivery.reason || "", counts, recentCount };
}

export async function runCriticalFollowUp(today = todayTaipei(), now = new Date()) {
  if (!isWeekdayDateKey(today)) return { status: "skipped", reason: "weekend", counts: {} };
  const [snapshot, recentKeys] = await Promise.all([
    loadNotificationSnapshot(today),
    loadRecentNotificationKeys(now)
  ]);
  const activeCritical = selectActiveNotificationItems(snapshot.items, { criticalOnly: true });
  const displayItems = excludeRecentlyPushedItems(activeCritical, recentKeys);
  const counts = notificationItemCounts(activeCritical);
  const recentCount = activeCritical.length - displayItems.length;
  if (!displayItems.length) {
    return {
      status: "skipped",
      reason: activeCritical.length ? "recently_pushed" : "no_critical_items",
      counts,
      recentCount
    };
  }
  const message = buildNotificationLineFlexMessage(displayItems, today, getNotificationAppUrl(), {
    mode: "critical_follow_up",
    summaryItems: activeCritical,
    recentCount
  });
  const delivery = await sendLoggedLineMessages({
    deliveryKey: `critical_follow_up:${today}`,
    scheduledDate: today,
    kind: "critical_follow_up",
    messages: [message],
    itemCounts: counts,
    notificationKeys: activeCritical.map((item) => item.key)
  });
  if (delivery.status === "sent") await markNotificationsLinePushed(displayItems);
  return { status: delivery.status, reason: delivery.reason || "", counts, recentCount };
}

function criticalDeliveryKey(items) {
  const fingerprint = items
    .map((item) => [item.key, item.source_updated_at || "", item.title, item.description].join("|"))
    .sort()
    .join("\n");
  return `critical_event:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`;
}

export async function sendImmediateCriticalTransition(beforeItems = [], afterItems = [], now = new Date()) {
  const parts = taipeiDateTimeParts(now);
  if (!isTaipeiBusinessTime(now)) {
    return { status: "skipped", reason: "outside_business_hours", today: parts.date };
  }
  const criticalItems = selectNewCriticalItems(beforeItems, afterItems);
  if (!criticalItems.length) return { status: "skipped", reason: "no_new_critical_state", today: parts.date };
  const counts = notificationItemCounts(criticalItems);
  const delivery = await sendLoggedLineMessages({
    deliveryKey: criticalDeliveryKey(criticalItems),
    scheduledDate: parts.date,
    kind: "critical_event",
    messages: [buildNotificationLineFlexMessage(criticalItems, parts.date, getNotificationAppUrl(), {
      mode: "critical_event"
    })],
    itemCounts: counts,
    notificationKeys: criticalItems.map((item) => item.key)
  });
  if (delivery.status === "sent") await markNotificationsLinePushed(criticalItems);
  return { status: delivery.status, reason: delivery.reason || "", today: parts.date, counts };
}

export function workNotificationItems(row, today = todayTaipei()) {
  return row ? buildNotificationItems({ today, workLogs: [row] }) : [];
}

export function contractNotificationItems(source, row, today = todayTaipei()) {
  if (!row) return [];
  return source === "contracts_mobile"
    ? buildNotificationItems({ today, mobileContracts: [row] })
    : buildNotificationItems({ today, contracts: [row] });
}

export function inspectionNotificationItems(record, today = todayTaipei()) {
  if (!record) return [];
  return buildNotificationItems({
    today,
    inspectionRecords: [record],
    inspectionItems: record.items || []
  });
}

export async function notifyWorkCriticalTransition(before, after, now = new Date()) {
  const today = taipeiDateTimeParts(now).date;
  return sendImmediateCriticalTransition(workNotificationItems(before, today), workNotificationItems(after, today), now);
}

export async function notifyContractCriticalTransition(source, before, after, now = new Date()) {
  const today = taipeiDateTimeParts(now).date;
  return sendImmediateCriticalTransition(
    contractNotificationItems(source, before, today),
    contractNotificationItems(source, after, today),
    now
  );
}

export async function notifyInspectionCriticalTransition(before, after, now = new Date()) {
  const today = taipeiDateTimeParts(now).date;
  return sendImmediateCriticalTransition(
    inspectionNotificationItems(before, today),
    inspectionNotificationItems(after, today),
    now
  );
}
