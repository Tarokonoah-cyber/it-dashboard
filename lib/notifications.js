import { addDateDays, isRecurringTaskDue, toDateKey } from "./recurringTasks";

export const NOTIFICATION_CATEGORIES = {
  overdue_work: { label: "逾期工作", icon: "!", href: "/work" },
  expiring_contract: { label: "合約到期", icon: "◇", href: "/contracts" },
  inspection_issue: { label: "巡檢異常", icon: "☑", href: "/inspections" },
  due_follow_up: { label: "待追蹤", icon: "↗", href: "/follow-ups" },
  recurring_task: { label: "週期任務", icon: "↻", href: "/work/recurring" }
};

const CLOSED_CONTRACT_PATTERN = /已續約|已終止|無合約|取消|關閉|closed|cancel/i;
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const LINE_SEVERITY_META = {
  critical: { label: "立即", color: "#8E2C25", background: "#FDECEC" },
  high: { label: "優先", color: "#A14B06", background: "#FFF3E6" },
  medium: { label: "留意", color: "#2F5D8A", background: "#EDF4FA" },
  low: { label: "一般", color: "#475467", background: "#F2F4F7" }
};
const DONE_STATUSES = new Set(["已處理", "已完成", "完成", "done", "closed", "已取消", "取消", "cancel", "cancelled", "canceled"]);
const HANDLED_STATUSES = new Set(["已處理", "已完成", "完成", "done", "closed"]);

function text(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function normalizedStatus(value) {
  return text(value).toLowerCase();
}

function isDoneStatus(value) {
  return DONE_STATUSES.has(normalizedStatus(value));
}

function isHandledStatus(value) {
  return HANDLED_STATUSES.has(normalizedStatus(value));
}

function dateKey(value) {
  const key = toDateKey(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function notification({ sourceType, sourceId, title, description, dueDate, severity, href, updatedAt }) {
  const meta = NOTIFICATION_CATEGORIES[sourceType];
  const id = text(sourceId);
  if (!meta || !id) return null;
  return {
    key: `${sourceType}:${id}`,
    source_type: sourceType,
    source_id: id,
    category_label: meta.label,
    icon: meta.icon,
    title: text(title, meta.label),
    description: text(description),
    due_date: dateKey(dueDate),
    severity: SEVERITY_ORDER[severity] === undefined ? "medium" : severity,
    href: href || meta.href,
    source_updated_at: updatedAt || null
  };
}

function workNotifications(rows, today) {
  return (rows || []).flatMap((row) => {
    const dueDate = dateKey(row.date);
    if (!dueDate || dueDate >= today || isDoneStatus(row.status)) return [];
    const title = text(row.title, "未命名工作");
    const item = notification({
      sourceType: "overdue_work",
      sourceId: row.id,
      title: `工作已逾期：${title}`,
      description: [`原定 ${dueDate}`, text(row.staff), text(row.category)].filter(Boolean).join(" · "),
      dueDate,
      severity: daysBetween(dueDate, today) >= 7 ? "critical" : "high",
      href: `/work?q=${encodeURIComponent(title)}`,
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function contractNotifications(contracts, mobileContracts, today) {
  const lastDate = addDateDays(today, 30);
  const rows = [
    ...(contracts || []).map((row) => ({
      ...row,
      source_kind: "software",
      display_name: text(row.contract_name || row.vendor, "未命名合約"),
      href: "/contracts/software"
    })),
    ...(mobileContracts || []).map((row) => ({
      ...row,
      source_kind: "mobile",
      display_name: [text(row.phone_no), text(row.user_name)].filter(Boolean).join(" ") || "手機門號合約",
      href: "/contracts/mobile"
    }))
  ];
  return rows.flatMap((row) => {
    const endDate = dateKey(row.end_date || row.expire_date);
    if (!endDate || endDate > lastDate || CLOSED_CONTRACT_PATTERN.test(text(row.status))) return [];
    const remaining = daysBetween(today, endDate);
    const item = notification({
      sourceType: "expiring_contract",
      sourceId: `${row.source_kind}:${row.id}`,
      title: remaining < 0 ? `合約已到期：${row.display_name}` : `合約即將到期：${row.display_name}`,
      description: remaining < 0 ? `已逾期 ${Math.abs(remaining)} 天` : remaining === 0 ? "今天到期" : `剩餘 ${remaining} 天`,
      dueDate: endDate,
      severity: remaining < 0 ? "critical" : remaining <= 7 ? "high" : "medium",
      href: row.href,
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function inspectionNotifications(items, records) {
  const recordsById = new Map((records || []).map((row) => [String(row.id), row]));
  return (items || []).flatMap((row) => {
    if (text(row.status, "正常") === "正常" || isHandledStatus(row.handling_status)) return [];
    const record = recordsById.get(String(row.inspection_record_id)) || {};
    const inspectionDate = dateKey(record.inspection_date);
    const item = notification({
      sourceType: "inspection_issue",
      sourceId: row.id,
      title: `巡檢${text(row.status, "異常")}：${text(row.item_name, "未命名項目")}`,
      description: [inspectionDate, text(row.issue_description, "尚未填寫異常說明"), text(row.handling_status, "未處理")].filter(Boolean).join(" · "),
      dueDate: inspectionDate,
      severity: text(row.status).includes("異常") ? "critical" : "high",
      href: record.id ? `/inspections/${record.id}` : "/inspections",
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function followUpNotifications(rows, today) {
  return (rows || []).flatMap((row) => {
    const dueDate = dateKey(row.next_follow_date);
    if (!dueDate || dueDate > today || isDoneStatus(row.current_status)) return [];
    const title = text(row.title, "未命名待追蹤");
    const item = notification({
      sourceType: "due_follow_up",
      sourceId: row.id,
      title: dueDate < today ? `追蹤已逾期：${title}` : `今天需追蹤：${title}`,
      description: [text(row.current_status), text(row.assignee)].filter(Boolean).join(" · "),
      dueDate,
      severity: dueDate < today ? "high" : "medium",
      href: `/follow-ups?q=${encodeURIComponent(title)}`,
      updatedAt: row.updated_at
    });
    return item ? [item] : [];
  });
}

function recurringNotifications(templates, occurrences, today) {
  const occurrenceByTemplate = new Map((occurrences || []).map((row) => [String(row.template_id), row]));
  return (templates || []).flatMap((template) => {
    if (!isRecurringTaskDue(template, today)) return [];
    const occurrence = occurrenceByTemplate.get(String(template.id));
    if (occurrence?.status === "generated") return [];
    const failed = occurrence?.status === "failed";
    const item = notification({
      sourceType: "recurring_task",
      sourceId: `${template.id}:${today}`,
      title: failed ? `週期任務產生失敗：${text(template.title)}` : `今日週期任務待產生：${text(template.title)}`,
      description: failed ? text(occurrence.error_message, "請重新執行週期任務") : [text(template.owner), text(template.priority)].filter(Boolean).join(" · "),
      dueDate: today,
      severity: failed ? "critical" : "medium",
      href: "/work/recurring",
      updatedAt: occurrence?.updated_at || template.updated_at
    });
    return item ? [item] : [];
  });
}

export function buildNotificationItems({
  today,
  workLogs = [],
  contracts = [],
  mobileContracts = [],
  inspectionItems = [],
  inspectionRecords = [],
  followUps = [],
  recurringTemplates = [],
  recurringOccurrences = []
}) {
  const items = [
    ...workNotifications(workLogs, today),
    ...contractNotifications(contracts, mobileContracts, today),
    ...inspectionNotifications(inspectionItems, inspectionRecords),
    ...followUpNotifications(followUps, today),
    ...recurringNotifications(recurringTemplates, recurringOccurrences, today)
  ];
  return items.sort((left, right) => {
    const severity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severity) return severity;
    return (left.due_date || "9999-12-31").localeCompare(right.due_date || "9999-12-31");
  });
}

export function applyNotificationStates(items, states, now = new Date().toISOString()) {
  const stateByKey = new Map((states || []).map((row) => [String(row.notification_key), row]));
  return (items || []).map((item) => {
    const state = stateByKey.get(item.key) || {};
    const snoozedUntil = state.snoozed_until || null;
    return {
      ...item,
      read_at: state.read_at || null,
      snoozed_until: snoozedUntil,
      line_pushed_at: state.line_pushed_at || null,
      is_read: Boolean(state.read_at),
      is_snoozed: Boolean(snoozedUntil && snoozedUntil > now)
    };
  });
}

export function summarizeNotifications(items) {
  const summary = { total: items.length, unread: 0, snoozed: 0, critical: 0, categories: {} };
  Object.keys(NOTIFICATION_CATEGORIES).forEach((key) => { summary.categories[key] = 0; });
  items.forEach((item) => {
    if (item.is_snoozed) summary.snoozed += 1;
    if (!item.is_read && !item.is_snoozed) summary.unread += 1;
    if (item.severity === "critical" && !item.is_snoozed) summary.critical += 1;
    summary.categories[item.source_type] = (summary.categories[item.source_type] || 0) + 1;
  });
  return summary;
}

export function validateNotificationKey(value) {
  const key = text(value);
  if (!key || key.length > 240 || !key.includes(":")) {
    const error = new Error("通知識別碼無效");
    error.name = "ValidationError";
    throw error;
  }
  return key;
}

export function validateSnoozeUntil(value, now = Date.now()) {
  const date = new Date(value);
  const max = now + 366 * 86400000;
  if (Number.isNaN(date.getTime()) || date.getTime() <= now || date.getTime() > max) {
    const error = new Error("延後提醒時間必須介於現在至一年內");
    error.name = "ValidationError";
    throw error;
  }
  return date.toISOString();
}

function oneLine(value, limit = 72) {
  const result = text(value).replace(/\s+/g, " ");
  return result.length > limit ? `${result.slice(0, limit - 1)}…` : result;
}

function firstCharacters(value, limit) {
  return Array.from(String(value || "")).slice(0, limit).join("");
}

function absoluteAppUrl(appUrl, path = "/notifications") {
  const base = text(appUrl).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return "";
  const safePath = String(path || "/notifications").startsWith("/") ? path : `/${path}`;
  return `${base}${safePath}`;
}

function displayDate(value) {
  const key = dateKey(value);
  return key ? `${key.slice(5, 7)}/${key.slice(8, 10)}` : "";
}

function lineDueLabel(item, today) {
  if (item?.source_type === "today_event") return text(item.event_time, "今日");
  const dueDate = dateKey(item?.due_date);
  if (!dueDate) return "待處理";
  if (item?.source_type === "inspection_issue") return `發現於 ${displayDate(dueDate)}`;
  if (item?.source_type === "recurring_task") return dueDate === today ? "今天" : displayDate(dueDate);
  const distance = daysBetween(dueDate, today);
  if (distance > 0) return `逾期 ${distance} 天`;
  if (distance === 0) return "今天";
  return `剩 ${Math.abs(distance)} 天`;
}

function lineSummary(items) {
  return (items || []).reduce((summary, item) => {
    summary.total += 1;
    summary[item.severity] = (summary[item.severity] || 0) + 1;
    summary.categories[item.source_type] = (summary.categories[item.source_type] || 0) + 1;
    return summary;
  }, { total: 0, critical: 0, high: 0, medium: 0, low: 0, categories: {} });
}

function categorySummary(summary) {
  return Object.entries(summary.categories)
    .map(([key, count]) => `${key === "today_event" ? "今日行程" : NOTIFICATION_CATEGORIES[key]?.label || "其他"} ${count}`)
    .join(" · ");
}

const LINE_MESSAGE_MODES = {
  daily_digest: {
    title: (summary) => summary.total ? `${summary.total} 件工作與行程` : "今日一切正常",
    subtitle: "通知中心與今日行程"
  },
  critical_event: {
    title: (summary) => `${summary.critical} 件需要立即處理`,
    subtitle: "剛進入重大狀態"
  },
  critical_follow_up: {
    title: (summary) => `${summary.critical} 件重大事項尚未完成`,
    subtitle: "已讀事項仍會持續提醒"
  },
  manual: {
    title: (summary) => summary.critical ? `${summary.critical} 件需要立即處理` : `${summary.total} 件待辦提醒`,
    subtitle: "依重要性排序"
  }
};

export function buildNotificationLineMessage(items, today, appUrl = "") {
  const rows = items || [];
  const summary = lineSummary(rows);
  const visible = rows.slice(0, 8);
  const headline = summary.critical ? `需要立即處理 ${summary.critical} 件` : `待處理事項 ${summary.total} 件`;
  const lines = [
    `【${headline}】`,
    `${today}｜全部 ${summary.total}・優先 ${summary.high}`,
    categorySummary(summary)
  ].filter(Boolean);
  visible.forEach((item) => {
    const marker = item.severity === "critical" ? "🔴" : item.severity === "high" ? "🟠" : "🔵";
    lines.push("", `${marker} ${lineDueLabel(item, today)}｜${item.category_label}`, oneLine(item.title, 64));
  });
  if (rows.length > visible.length) lines.push("", `另有 ${rows.length - visible.length} 件，請至通知中心查看。`);
  const centerUrl = absoluteAppUrl(appUrl);
  if (centerUrl) lines.push("", centerUrl);
  const result = lines.join("\n");
  return result.length > 4900 ? `${result.slice(0, 4899)}…` : result;
}

function flexSummaryPill(label, value, color, background) {
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    backgroundColor: background,
    cornerRadius: "16px",
    height: "32px",
    justifyContent: "center",
    paddingStart: "7px",
    paddingEnd: "7px",
    contents: [{
      type: "text",
      text: `${label} ${value}`,
      size: "xs",
      weight: "bold",
      color,
      align: "center"
    }]
  };
}

function headerDateLabel(value) {
  const key = dateKey(value);
  return key ? key.replaceAll("-", "/") : text(value);
}

function headerTitle(summary, mode, isAllClear) {
  if (isAllClear) return "今日一切正常";
  if (summary.critical) return `${summary.critical} 件需要立即處理`;
  return summary.total ? `${summary.total} 件需要留意` : mode.title(summary);
}

function longOverdueCount(items, today) {
  return (items || []).filter((item) => {
    const dueDate = dateKey(item?.due_date);
    if (!dueDate || item?.source_type === "inspection_issue" || item?.source_type === "recurring_task" || item?.source_type === "today_event") return false;
    return daysBetween(dueDate, today) > 14;
  }).length;
}

function lineOwner(item) {
  const parts = text(item?.description).split(" · ").map((part) => part.trim()).filter(Boolean);
  if (item?.source_type === "overdue_work") {
    return parts.find((part) => !/^原定\s*\d{4}-\d{2}-\d{2}$/.test(part)) || "";
  }
  if (item?.source_type === "due_follow_up") return parts.at(-1) || "";
  if (item?.source_type === "recurring_task" && parts.length > 1) return parts[0];
  return "";
}

function lineMetaLabel(item) {
  if (item?.source_type === "today_event") {
    return [text(item.event_time), text(item.description).split(" · ").at(-1)].filter(Boolean).join(" · ") || "今日行程";
  }
  const due = displayDate(item?.due_date);
  const dateLabel = !due ? "" : item?.source_type === "expiring_contract"
    ? `到期 ${due}`
    : item?.source_type === "inspection_issue"
      ? `發現 ${due}`
      : `原定 ${due}`;
  return [lineOwner(item), dateLabel].filter(Boolean).join(" · ") || oneLine(item?.description, 52) || "日期未提供";
}

function flexNotificationRow(item, today, appUrl) {
  const severity = LINE_SEVERITY_META[item.severity] || LINE_SEVERITY_META.medium;
  const dueLabel = lineDueLabel(item, today);
  const itemUrl = absoluteAppUrl(appUrl, item?.href);
  const contents = [
    {
      type: "box",
      layout: "horizontal",
      alignItems: "center",
      contents: [
        {
          type: "box",
          layout: "vertical",
          backgroundColor: severity.background,
          cornerRadius: "8px",
          paddingStart: "7px",
          paddingEnd: "7px",
          paddingTop: "3px",
          paddingBottom: "3px",
          flex: 0,
          contents: [{
            type: "text",
            text: severity.label,
            size: "xxs",
            weight: "bold",
            color: severity.color,
            flex: 0
          }]
        },
        {
          type: "text",
          text: dueLabel,
          size: "xs",
          weight: dueLabel.startsWith("逾期 ") ? "bold" : "regular",
          color: dueLabel.startsWith("逾期 ") ? "#B42318" : "#667085",
          align: "end",
          flex: 1
        }
      ]
    },
    {
      type: "text",
      text: oneLine(item.title, 80),
      size: "sm",
      weight: "bold",
      color: "#101828",
      wrap: true,
      maxLines: 2,
      margin: "sm"
    },
    {
      type: "text",
      text: item.category_label,
      size: "xs",
      color: "#667085",
      margin: "sm"
    },
    {
      type: "text",
      text: lineMetaLabel(item),
      size: "xs",
      color: "#667085",
      wrap: true,
      maxLines: 1,
      margin: "xs"
    }
  ];
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: "#F8FAFC",
    cornerRadius: "10px",
    paddingAll: "12px",
    ...(itemUrl ? { action: { type: "uri", label: "開啟事項", uri: itemUrl } } : {}),
    contents
  };
}

export function buildNotificationLineFlexMessage(items, today, appUrl = "", options = {}) {
  const rows = items || [];
  const summaryRows = Array.isArray(options.summaryItems) ? options.summaryItems : rows;
  const summary = lineSummary(summaryRows);
  const visible = rows.slice(0, 3);
  const hasCritical = summary.critical > 0;
  const mode = LINE_MESSAGE_MODES[options.mode] || LINE_MESSAGE_MODES.manual;
  const isAllClear = options.mode === "daily_digest" && summary.total === 0;
  const recentCount = Math.max(0, Number(options.recentCount) || 0);
  const overdueCount = longOverdueCount(summaryRows, today);
  const title = headerTitle(summary, mode, isAllClear);
  const subtitle = isAllClear
    ? "目前沒有待處理通知或今日行程"
    : overdueCount
      ? `其中 ${overdueCount} 件已逾期超過 14 天`
      : mode.subtitle;
  const accentColor = isAllClear ? "#15705A" : hasCritical ? "#8E2C25" : summary.high ? "#B76E00" : "#456A89";
  const centerUrl = absoluteAppUrl(appUrl);
  const hiddenCount = Math.max(0, summary.total - visible.length);
  const bodyContents = [
    {
      type: "box",
      layout: "horizontal",
      spacing: "xs",
      contents: [
        flexSummaryPill("立即", summary.critical, "#8E2C25", "#FDECEC"),
        flexSummaryPill("優先", summary.high, "#A14B06", "#FFF3E6"),
        flexSummaryPill("全部", summary.total, "#344054", "#EEF2F6")
      ]
    },
    ...(isAllClear ? [{
      type: "box",
      layout: "vertical",
      backgroundColor: "#ECFDF3",
      cornerRadius: "12px",
      paddingAll: "16px",
      margin: "lg",
      contents: [
        { type: "text", text: "✓ 今日一切正常", size: "md", weight: "bold", color: "#067647", align: "center" },
        { type: "text", text: "目前沒有待處理通知或今日行程", size: "xs", color: "#475467", align: "center", wrap: true, margin: "sm" }
      ]
    }] : [
      { type: "text", text: "重點事項", size: "xs", weight: "bold", color: "#475467", margin: "sm" },
      ...visible.map((item) => flexNotificationRow(item, today, appUrl))
    ]),
    ...(visible.length === 3 && hiddenCount ? [{
      type: "text",
      text: `另有 ${hiddenCount} 件事項未顯示`,
      size: "xs",
      color: "#667085",
      align: "center",
      margin: "sm",
      wrap: true
    }] : []),
    ...(!isAllClear && !visible.length && recentCount ? [{
      type: "text",
      text: `${recentCount} 件已於最近 4 小時通知，本次不重複列出`,
      size: "xs",
      color: "#667085",
      align: "center",
      margin: "lg",
      wrap: true
    }] : [])
  ];
  const footerContents = [];
  if (centerUrl) {
    footerContents.push({ type: "separator", color: "#EAECF0" });
    footerContents.push({
      type: "button",
      style: "primary",
      height: "sm",
      color: "#8E2C25",
      margin: "md",
      action: { type: "uri", label: "開啟通知中心", uri: centerUrl }
    });
  }

  const altText = isAllClear
    ? `今日工作摘要｜${today}｜今日一切正常`
    : firstCharacters(`${title}｜${today}\n${buildNotificationLineMessage(summaryRows, today, appUrl)}`, 400);
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "horizontal",
        backgroundColor: "#F8FAFC",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            width: "4px",
            height: "66px",
            flex: 0,
            backgroundColor: accentColor,
            cornerRadius: "2px",
            contents: []
          },
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "TAROKO · MIS", size: "xxs", weight: "bold", color: "#667085", flex: 1 },
                  { type: "text", text: headerDateLabel(today), size: "xxs", color: "#98A2B3", align: "end", flex: 1 }
                ]
              },
              {
                type: "text",
                text: title,
                size: "lg",
                weight: "bold",
                color: "#182230",
                wrap: true,
                maxLines: 2,
                margin: "sm"
              },
              { type: "text", text: subtitle, size: "xs", color: "#667085", wrap: true, maxLines: 1, margin: "xs" }
            ]
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: bodyContents
      },
      ...(footerContents.length ? {
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "16px",
          paddingTop: "none",
          contents: footerContents
        }
      } : {})
    }
  };
}
