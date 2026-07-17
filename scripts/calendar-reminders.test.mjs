import assert from "node:assert/strict";
import test from "node:test";
import {
  countActionableToday,
  selectTodayFollowUps,
  selectUpcomingContractReminders
} from "../lib/calendarReminders.js";

test("selectUpcomingContractReminders keeps active contracts due within 50 days", () => {
  const result = selectUpcomingContractReminders([
    { id: "today", contract_name: "今日到期", end_date: "2026-07-17", status: "使用中" },
    { id: "last", contract_name: "第 50 天", end_date: "2026-09-05", status: "使用中" },
    { id: "late", contract_name: "第 51 天", end_date: "2026-09-06", status: "使用中" },
    { id: "closed", contract_name: "已續約", end_date: "2026-08-01", status: "已續約" }
  ], [
    { id: "mobile", phone_no: "0912-000-000", user_name: "王小明", end_date: "2026-08-20", status: "使用中" }
  ], "2026-07-17", 50);

  assert.deepEqual(result.map((item) => item.id), ["today", "mobile", "last"]);
  assert.equal(result[1].title, "0912-000-000 王小明");
});

test("countActionableToday includes only work scheduled for today", () => {
  assert.equal(countActionableToday([
    { date: "2026-07-16" },
    { date: "2026-07-17" },
    { date: "2026-07-18" }
  ], "2026-07-17"), 1);
});

test("selectTodayFollowUps includes only follow-ups scheduled for today", () => {
  const result = selectTodayFollowUps([
    { id: "past", next_follow_date: "2026-07-16", title: "昨天追蹤" },
    { id: "today", next_follow_date: "2026-07-17T09:00:00+08:00", title: "今天追蹤" },
    { id: "future", next_follow_date: "2026-07-18", title: "明天追蹤" },
    { id: "work", date: "2026-07-17", title: "一般工作，不算追蹤" }
  ], "2026-07-17");

  assert.deepEqual(result.map((item) => item.id), ["today"]);
});
