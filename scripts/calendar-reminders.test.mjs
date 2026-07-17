import assert from "node:assert/strict";
import test from "node:test";
import {
  countActionableToday,
  selectTodayFollowUpReminders,
  selectUpcomingContractReminders
} from "../lib/calendarReminders.js";
import { getContractLifecycleStatus, isContractExpiringWithin } from "../lib/contractStatus.js";

test("selectUpcomingContractReminders keeps active contracts due within 30 days", () => {
  const result = selectUpcomingContractReminders([
    { id: "today", contract_name: "今日到期", end_date: "2026-07-17", status: "使用中" },
    { id: "last", contract_name: "第 30 天", end_date: "2026-08-16", status: "有效" },
    { id: "late", contract_name: "第 31 天", end_date: "2026-08-17", status: "有效" },
    { id: "closed", contract_name: "已中止", end_date: "2026-08-01", status: "中止" }
  ], [
    { id: "mobile", phone_no: "0912-000-000", user_name: "王小明", end_date: "2026-08-10", status: "使用中" }
  ], "2026-07-17", 30);

  assert.deepEqual(result.map((item) => item.id), ["today", "mobile", "last"]);
  assert.equal(result[1].title, "0912-000-000 王小明");
});

test("contract lifecycle status is automatic within the final 30 days", () => {
  assert.equal(getContractLifecycleStatus({ end_date: "2026-08-16", status: "有效" }, "2026-07-17"), "即期");
  assert.equal(getContractLifecycleStatus({ end_date: "2026-08-17", status: "有效" }, "2026-07-17"), "有效");
  assert.equal(getContractLifecycleStatus({ end_date: "2026-08-17", status: "即期" }, "2026-07-17"), "有效");
  assert.equal(getContractLifecycleStatus({ end_date: "2026-08-01", status: "中止" }, "2026-07-17"), "中止");
  assert.equal(isContractExpiringWithin({ end_date: "2026-07-16", status: "有效" }, "2026-07-17"), false);
});

test("countActionableToday includes only work scheduled for today", () => {
  assert.equal(countActionableToday([
    { date: "2026-07-16" },
    { date: "2026-07-17" },
    { date: "2026-07-18" }
  ], "2026-07-17"), 1);
});

test("selectTodayFollowUpReminders includes only follow-up work actionable today", () => {
  const result = selectTodayFollowUpReminders([
    { id: "past", next_follow_date: "2026-07-16", title: "昨天追蹤" },
    { id: "today", next_follow_date: "2026-07-17T09:00:00+08:00", title: "今天追蹤" },
    { id: "future", next_follow_date: "2026-07-18", title: "明天追蹤" },
  ], [
    { id: "duplicate", source: "follow_ups", source_id: "today", date: "2026-07-17", title: "今天追蹤" },
    { id: "promoted", source: "follow_ups", source_id: "overdue", date: "2026-07-17", title: "逾期後今日處理" },
    { id: "work", date: "2026-07-17", title: "一般工作，不算追蹤" },
    { id: "future-work", source: "follow_ups", date: "2026-07-18", title: "明天追蹤" }
  ], "2026-07-17");

  assert.deepEqual(result.map((item) => item.id), ["today", "promoted"]);
});
