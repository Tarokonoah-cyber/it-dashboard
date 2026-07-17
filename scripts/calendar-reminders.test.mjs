import assert from "node:assert/strict";
import test from "node:test";
import { countActionableToday, selectUpcomingContractReminders } from "../lib/calendarReminders.js";

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
