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

test("recurring rules cover daily, weekdays, weekly and month-end clamping", async () => {
  const { isRecurringTaskDue } = await namespace("../lib/recurringTasks.js");
  const base = { is_active: true, start_date: "2026-01-01" };
  assert.equal(isRecurringTaskDue({ ...base, recurrence_kind: "daily" }, "2026-07-18"), true);
  assert.equal(isRecurringTaskDue({ ...base, recurrence_kind: "weekdays" }, "2026-07-17"), true);
  assert.equal(isRecurringTaskDue({ ...base, recurrence_kind: "weekdays" }, "2026-07-18"), false);
  assert.equal(isRecurringTaskDue({ ...base, recurrence_kind: "weekly", weekday: 1 }, "2026-07-20"), true);
  assert.equal(isRecurringTaskDue({ ...base, recurrence_kind: "monthly", day_of_month: 31 }, "2026-02-28"), true);
  assert.equal(isRecurringTaskDue({ ...base, recurrence_kind: "monthly", day_of_month: 31 }, "2028-02-29"), true);
});

test("recurring evaluation only backfills after the first checked date and respects bounds", async () => {
  const { getRecurringEvaluationDates } = await namespace("../lib/recurringTasks.js");
  const firstRun = getRecurringEvaluationDates({
    is_active: true,
    recurrence_kind: "daily",
    start_date: "2026-07-01"
  }, "2026-07-16");
  assert.deepEqual([...firstRun], ["2026-07-16"]);

  const catchUp = getRecurringEvaluationDates({
    is_active: true,
    recurrence_kind: "weekdays",
    start_date: "2026-07-01",
    end_date: "2026-07-17",
    last_checked_date: "2026-07-12"
  }, "2026-07-20");
  assert.deepEqual([...catchUp], ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]);
});

test("recurring task payload validates rule-specific fields", async () => {
  const { buildRecurringTaskPayload } = await namespace("../lib/recurringTasks.js");
  const payload = buildRecurringTaskPayload({
    title: "檢查每日備份",
    recurrence_kind: "weekly",
    weekday: 5,
    priority: "重要",
    owner: "MIS",
    start_date: "2026-07-17"
  });
  assert.equal(payload.weekday, 5);
  assert.equal(payload.day_of_month, null);
  assert.equal(payload.priority, "重要");
  assert.throws(() => buildRecurringTaskPayload({
    title: "月底任務",
    recurrence_kind: "monthly",
    day_of_month: 32,
    start_date: "2026-07-17"
  }), /1 到 31/);
});

test("digest selectors include only actionable work, due follow-ups and 30-day contracts", async () => {
  const { selectDueFollowUps, selectExpiringContracts, selectImportantWorks } = await namespace("../lib/reminderDigest.js");
  assert.deepEqual(selectImportantWorks([
    { id: "a", impact: "重要", status: "未完成" },
    { id: "b", impact: "一般", status: "未完成" },
    { id: "c", impact: "重要", status: "已完成" }
  ]).map((row) => row.id), ["a"]);
  assert.deepEqual(selectDueFollowUps([
    { id: "a", next_follow_date: "2026-07-16", current_status: "等待回覆" },
    { id: "b", next_follow_date: "2026-07-17", current_status: "等待回覆" },
    { id: "c", next_follow_date: "2026-07-15", current_status: "已完成" }
  ], "2026-07-16").map((row) => row.id), ["a"]);
  const contracts = selectExpiringContracts([
    { id: "expired", contract_name: "A", end_date: "2026-07-10", status: "使用中" },
    { id: "thirty", contract_name: "B", end_date: "2026-08-15", status: "使用中" },
    { id: "later", contract_name: "C", end_date: "2026-08-16", status: "使用中" },
    { id: "closed", contract_name: "D", end_date: "2026-07-20", status: "已續約" }
  ], [], "2026-07-16", 30);
  assert.deepEqual(contracts.map((row) => row.id), ["expired", "thirty"]);
});

test("LINE digest caps each section at five rows and includes dashboard link", async () => {
  const { buildLineDigest } = await namespace("../lib/reminderDigest.js");
  const importantWorks = Array.from({ length: 7 }, (_, index) => ({ title: `重要任務 ${index + 1}` }));
  const result = buildLineDigest({
    today: "2026-07-16",
    importantWorks,
    appUrl: "https://example.test/"
  });
  assert.equal(result.counts.important, 7);
  assert.match(result.text, /重要未完成 7 件/);
  assert.match(result.text, /重要任務 5/);
  assert.doesNotMatch(result.text, /重要任務 6/);
  assert.match(result.text, /另 2 件/);
  assert.match(result.text, /https:\/\/example\.test$/);
});

test("digest runs Monday through Friday and cron authorization is exact", async () => {
  const { isDigestWeekday } = await namespace("../lib/reminderDigest.js");
  const { isCronAuthorized } = await namespace("../lib/cronAuth.js");
  assert.equal(isDigestWeekday("2026-07-17"), true);
  assert.equal(isDigestWeekday("2026-07-18"), false);
  const request = (value) => ({ headers: { get: () => value } });
  assert.equal(isCronAuthorized(request("Bearer correct"), "correct"), true);
  assert.equal(isCronAuthorized(request("Bearer wrong"), "correct"), false);
  assert.equal(isCronAuthorized(request("Bearer correct"), ""), false);
});
