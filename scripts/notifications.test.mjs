import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const moduleCache = new Map();

async function loadModule(relativePath, parentUrl = import.meta.url) {
  let url = new URL(relativePath, parentUrl);
  if (!/\.[a-z0-9]+$/i.test(url.pathname)) url = new URL(`${url.href}.js`);
  if (moduleCache.has(url.href)) return moduleCache.get(url.href);
  const promise = (async () => {
    const code = await readFile(url, "utf8");
    const sourceModule = new vm.SourceTextModule(code, { identifier: url.href });
    await sourceModule.link((specifier, referencingModule) => loadModule(specifier, referencingModule.identifier));
    await sourceModule.evaluate();
    return sourceModule;
  })();
  moduleCache.set(url.href, promise);
  return promise;
}

async function namespace(relativePath) {
  return (await loadModule(relativePath)).namespace;
}

test("notification builder combines all five actionable sources", async () => {
  const { buildNotificationItems } = await namespace("../lib/notifications.js");
  const items = buildNotificationItems({
    today: "2026-07-17",
    workLogs: [
      { id: "work-1", date: "2026-07-10", title: "修復交換器", status: "未完成" },
      { id: "work-done", date: "2026-07-10", title: "已處理", status: "已完成" }
    ],
    contracts: [{ id: "contract-1", contract_name: "防毒授權", end_date: "2026-07-25", status: "有效" }],
    inspectionItems: [{ id: "issue-1", inspection_record_id: "record-1", item_name: "機房溫度", status: "異常", handling_status: "未處理" }],
    inspectionRecords: [{ id: "record-1", inspection_date: "2026-07-17" }],
    followUps: [{ id: "follow-1", title: "確認報價", next_follow_date: "2026-07-17", current_status: "等待回覆" }],
    recurringTemplates: [{ id: "template-1", title: "檢查備份", recurrence_kind: "weekly", weekday: 5, is_active: true, start_date: "2026-01-01" }]
  });
  assert.equal(items.length, 5);
  assert.deepEqual(new Set(items.map((item) => item.source_type)), new Set([
    "overdue_work",
    "expiring_contract",
    "inspection_issue",
    "due_follow_up",
    "recurring_task"
  ]));
  assert.equal(items.some((item) => item.source_id === "work-done"), false);
});

test("generated recurring occurrences do not remain in the notification center", async () => {
  const { buildNotificationItems } = await namespace("../lib/notifications.js");
  const items = buildNotificationItems({
    today: "2026-07-17",
    recurringTemplates: [{ id: "template-1", title: "檢查備份", recurrence_kind: "daily", is_active: true, start_date: "2026-01-01" }],
    recurringOccurrences: [{ template_id: "template-1", occurrence_date: "2026-07-17", status: "generated" }]
  });
  assert.equal(items.length, 0);
});

test("read and snoozed state produces the correct summary", async () => {
  const { applyNotificationStates, summarizeNotifications } = await namespace("../lib/notifications.js");
  const base = [
    { key: "overdue_work:a", source_type: "overdue_work", severity: "critical" },
    { key: "due_follow_up:b", source_type: "due_follow_up", severity: "medium" },
    { key: "inspection_issue:c", source_type: "inspection_issue", severity: "high" }
  ];
  const items = applyNotificationStates(base, [
    { notification_key: "overdue_work:a", read_at: "2026-07-17T00:00:00.000Z" },
    { notification_key: "due_follow_up:b", snoozed_until: "2026-07-20T00:00:00.000Z" }
  ], "2026-07-17T12:00:00.000Z");
  const summary = summarizeNotifications(items);
  assert.equal(summary.unread, 1);
  assert.equal(summary.snoozed, 1);
  assert.equal(summary.critical, 1);
});

test("snooze validation rejects past dates and LINE output includes the center link", async () => {
  const { buildNotificationLineMessage, validateSnoozeUntil } = await namespace("../lib/notifications.js");
  assert.throws(() => validateSnoozeUntil("2026-07-16T00:00:00.000Z", new Date("2026-07-17T00:00:00.000Z").getTime()), /一年內/);
  const message = buildNotificationLineMessage([
    { category_label: "逾期工作", title: "修復交換器", due_date: "2026-07-16" }
  ], "2026-07-17", "https://example.test/");
  assert.match(message, /修復交換器/);
  assert.match(message, /https:\/\/example\.test\/notifications/);
});
