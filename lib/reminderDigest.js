import { addDateDays, isoWeekday, toDateKey } from "./recurringTasks";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const CLOSED_CONTRACT_PATTERN = /已續約|已完成|取消|中止|終止|失效|closed|cancel/i;

function oneLine(value, maxLength = 64) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function dateValue(row, keys) {
  for (const key of keys) {
    const value = toDateKey(row?.[key]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return "";
}

export function isDigestWeekday(date) {
  const weekday = isoWeekday(date);
  return weekday >= 1 && weekday <= 5;
}

export function selectImportantWorks(rows) {
  return (rows || []).filter((row) => {
    if (DONE_STATUSES.has(String(row?.status || "").trim())) return false;
    return String(row?.impact || row?.priority || "").trim() === "重要";
  });
}

export function selectDueFollowUps(rows, today) {
  return (rows || []).filter((row) => {
    if (String(row?.current_status || "").trim() === "已完成") return false;
    const date = dateValue(row, ["next_follow_date"]);
    return Boolean(date && date <= today);
  });
}

export function selectExpiringContracts(contracts, mobileContracts, today, windowDays = 30) {
  const lastDate = addDateDays(today, windowDays);
  const software = (contracts || []).map((row) => ({
    ...row,
    reminder_type: "軟體",
    reminder_title: row.contract_name || row.vendor || "未命名合約"
  }));
  const mobile = (mobileContracts || []).map((row) => ({
    ...row,
    reminder_type: "門號",
    reminder_title: [row.phone_no, row.user_name].filter(Boolean).join(" ") || "未命名門號"
  }));
  return [...software, ...mobile]
    .filter((row) => {
      if (CLOSED_CONTRACT_PATTERN.test(String(row.status || ""))) return false;
      const endDate = dateValue(row, ["end_date", "expire_date"]);
      return Boolean(endDate && endDate <= lastDate);
    })
    .sort((left, right) => dateValue(left, ["end_date", "expire_date"]).localeCompare(dateValue(right, ["end_date", "expire_date"])));
}

function section(icon, title, rows, formatRow) {
  if (!rows.length) return [];
  const visible = rows.slice(0, 5);
  return [
    `${icon} ${title} ${rows.length} 件`,
    ...visible.map((row, index) => `${index + 1}. ${oneLine(formatRow(row))}`),
    ...(rows.length > visible.length ? [`…另 ${rows.length - visible.length} 件`] : [])
  ];
}

export function buildLineDigest({
  today,
  importantWorks = [],
  dueFollowUps = [],
  calendarEvents = [],
  inspectionIssues = [],
  expiringContracts = [],
  appUrl = ""
}) {
  const sections = [
    section("🔴", "重要未完成", importantWorks, (row) => row.title || "未命名工作"),
    section("⏰", "到期／逾期追蹤", dueFollowUps, (row) => `${toDateKey(row.next_follow_date)} ${row.title || "未命名追蹤"}`),
    section("📅", "今日行程", calendarEvents, (row) => `${row.event_time ? String(row.event_time).slice(0, 5) : "整日"} ${row.title || "未命名行程"}`),
    section("⚠️", "最近巡檢異常", inspectionIssues, (row) => `${toDateKey(row.inspection_date)} ${row.item_name || row.title || "巡檢異常"}${row.issue_description ? `：${row.issue_description}` : ""}`),
    section("📄", "已逾期／30 天內到期合約", expiringContracts, (row) => `${toDateKey(row.end_date || row.expire_date)} [${row.reminder_type}] ${row.reminder_title}`)
  ].filter((rows) => rows.length);
  const counts = {
    important: importantWorks.length,
    followUps: dueFollowUps.length,
    calendar: calendarEvents.length,
    inspections: inspectionIssues.length,
    contracts: expiringContracts.length
  };
  const lines = [`【今日工作摘要 ${today}】`];
  if (sections.length) sections.forEach((rows, index) => lines.push(...(index ? [""] : []), ...rows));
  else lines.push("今日無重要或逾期事項");
  if (appUrl) lines.push("", `查看儀表板：${String(appUrl).replace(/\/+$/, "")}`);
  const text = lines.join("\n");
  return { text: text.length > 4900 ? `${text.slice(0, 4899)}…` : text, counts };
}
