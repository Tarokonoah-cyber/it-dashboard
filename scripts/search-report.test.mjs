import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadModule(relativePath) {
  const code = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: relativePath });
  await sourceModule.link(() => { throw new Error("Unexpected test import"); });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

test("password search result never exposes secret fields", async () => {
  const { safePasswordSearchResult } = await loadModule("../lib/search-utils.js");
  const result = safePasswordSearchResult({
    id: "pw-1",
    category: "網路",
    system_name: "核心交換器",
    bitwarden_item_name: "Switch Admin",
    username: "admin",
    password: "super-secret",
    note: "private note"
  });
  assert.deepEqual(Object.keys(result).sort(), ["category", "href", "id", "searchText", "source", "subtitle", "title"].sort());
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
  assert.equal(JSON.stringify(result).includes("admin"), false);
  assert.equal(JSON.stringify(result).includes("private note"), false);
});

test("search ranking favors exact title and caps each category", async () => {
  const { rankSearchResults } = await loadModule("../lib/search-utils.js");
  const results = [
    { id: "exact", category: "工作", title: "VPN", searchText: "VPN" },
    { id: "prefix", category: "工作", title: "VPN 維護", searchText: "VPN 維護" },
    { id: "body", category: "文件", title: "網路手冊", searchText: "網路手冊 VPN" }
  ];
  const ranked = rankSearchResults(results, "vpn", 10, 1);
  assert.deepEqual(ranked.map((row) => row.id), ["exact", "body"]);
});

test("work report summary calculates completion KPI", async () => {
  const { buildWorkReportSummary, normalizeWorkReportRow } = await loadModule("../lib/reporting.js");
  const rows = [
    normalizeWorkReportRow({ id: 1, date: "2026-07-01", title: "A", status: "已完成", work_type: "維護" }),
    normalizeWorkReportRow({ id: 2, date: "2026-07-02", title: "B", status: "進行中", work_type: "維護" }),
    normalizeWorkReportRow({ id: 3, date: "2026-07-03", title: "C", status: "完成", work_type: "專案" })
  ];
  const summary = buildWorkReportSummary(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.completed, 2);
  assert.equal(summary.open, 1);
  assert.equal(summary.completionRate, 67);
  assert.deepEqual({ ...summary.byType }, { 維護: 2, 專案: 1 });
});

test("inspection report separates daily and monthly items", async () => {
  const { buildInspectionReportSummary, normalizeInspectionRecord } = await loadModule("../lib/reporting.js");
  const record = normalizeInspectionRecord({
    id: "inspection-1",
    inspection_date: "2026-07-15",
    inspector_name: "MIS",
    overall_status: "異常",
    items: [
      { id: "a", item_name: "NAS / 備份", category: "備份", status: "正常" },
      { id: "b", item_name: "機房溫度", category: "機房", status: "異常", issue_description: "過高" },
      { id: "c", item_name: "網路狀態", category: "網路", status: "待觀察" }
    ]
  });
  const daily = buildInspectionReportSummary([record], "daily");
  const monthly = buildInspectionReportSummary([record], "monthly");
  assert.equal(daily.items, 2);
  assert.equal(daily.abnormal, 1);
  assert.equal(daily.observation, 1);
  assert.equal(monthly.items, 1);
  assert.equal(monthly.normal, 1);
});

test("dashboard completion rate only counts the current month", async () => {
  const { getMonthCompletionMetrics, getWorkPriorityLabel } = await loadModule("../lib/dashboard-metrics.js");
  const works = [
    { date: "2026-07-01", status: "已完成", impact: "一般" },
    { date: "2026-07-05", status: "未完成", impact: "重要" },
    { date: "2026-06-20", status: "已完成", impact: "緊急" },
    { date: "2026-06-21", status: "已完成", impact: "一般" }
  ];
  assert.deepEqual({ ...getMonthCompletionMetrics(works, "2026-07-16") }, { completed: 1, total: 2, rate: 50 });
  assert.equal(getWorkPriorityLabel(works[0]), "一般");
  assert.equal(getWorkPriorityLabel(works[1]), "重要");
  assert.equal(getWorkPriorityLabel(works[2]), "重要");
});

test("work completion finds only related open follow-ups", async () => {
  const { findRelatedFollowUps } = await loadModule("../lib/work-follow-up.js");
  const work = { id: "work-1", title: "確認 VPN 更新進度", source: "todo_logs", source_id: "todo-9" };
  const rows = [
    { id: "same-source", title: "供應商回覆", source_todo_id: "todo-9", current_status: "等待回覆" },
    { id: "same-title", title: "確認VPN更新進度", current_status: "處理中" },
    { id: "completed", title: "確認 VPN 更新進度", current_status: "已完成" },
    { id: "unrelated", title: "更新機房標籤", current_status: "等待回覆" }
  ];
  assert.deepEqual(findRelatedFollowUps(work, rows).map((row) => row.id), ["same-source", "same-title"]);
});

test("follow-ups are due on or before their scheduled date", async () => {
  const { getTomorrowDate, isDueFollowUp } = await loadModule("../lib/work-follow-up.js");
  assert.equal(isDueFollowUp({ next_follow_date: "2026-07-15", current_status: "等待回覆" }, "2026-07-16"), true);
  assert.equal(isDueFollowUp({ next_follow_date: "2026-07-16", current_status: "處理中" }, "2026-07-16"), true);
  assert.equal(isDueFollowUp({ next_follow_date: "2026-07-17", current_status: "等待回覆" }, "2026-07-16"), false);
  assert.equal(isDueFollowUp({ next_follow_date: "2026-07-15", current_status: "已完成" }, "2026-07-16"), false);
  assert.equal(getTomorrowDate("2026-12-31"), "2027-01-01");
});
