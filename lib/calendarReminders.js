import { addDateDays, toDateKey } from "./recurringTasks.js";

const CLOSED_CONTRACT_PATTERN = /已續約|已完成|取消|終止|失效|closed|cancel/i;

function contractDate(row) {
  return toDateKey(row?.end_date || row?.expire_date);
}

export function selectUpcomingContractReminders(contracts, mobileContracts, today, windowDays = 50) {
  const startDate = toDateKey(today);
  const lastDate = addDateDays(startDate, windowDays);
  if (!startDate || !lastDate) return [];

  const software = (contracts || []).map((row) => ({
    id: row.id,
    reminder_type: "software",
    title: row.contract_name || row.vendor || "未命名合約",
    end_date: contractDate(row),
    status: row.status || ""
  }));
  const mobile = (mobileContracts || []).map((row) => ({
    id: row.id,
    reminder_type: "mobile",
    title: [row.phone_no, row.user_name].filter(Boolean).join(" ") || "未命名門號",
    end_date: contractDate(row),
    status: row.status || ""
  }));

  return [...software, ...mobile]
    .filter((row) => (
      row.end_date >= startDate
      && row.end_date <= lastDate
      && !CLOSED_CONTRACT_PATTERN.test(String(row.status || ""))
    ))
    .sort((left, right) => left.end_date.localeCompare(right.end_date) || left.title.localeCompare(right.title, "zh-Hant"));
}

export function selectActionableTodayWorks(works, today) {
  const todayKey = toDateKey(today);
  if (!todayKey) return [];
  return (works || []).filter((work) => {
    const workDate = toDateKey(work?.date || work?.due_date || work?.created_at);
    return workDate === todayKey;
  });
}

export function countActionableToday(works, today) {
  return selectActionableTodayWorks(works, today).length;
}

export function selectTodayFollowUpReminders(followUps, works, today) {
  const todayKey = toDateKey(today);
  if (!todayKey) return [];
  const reminders = [];
  const sourceIds = new Set();

  (followUps || []).forEach((followUp) => {
    if (toDateKey(followUp?.next_follow_date) !== todayKey) return;
    const id = String(followUp?.id || "").trim();
    if (id) sourceIds.add(id);
    reminders.push(followUp);
  });

  (works || []).forEach((work) => {
    const source = String(work?.source || "").trim().toLowerCase();
    const workDate = toDateKey(work?.date || work?.due_date || work?.created_at);
    if (source !== "follow_ups" || workDate !== todayKey) return;
    const sourceId = String(work?.source_id || "").trim();
    if (sourceId && sourceIds.has(sourceId)) return;
    if (sourceId) sourceIds.add(sourceId);
    reminders.push(work);
  });

  return reminders;
}
