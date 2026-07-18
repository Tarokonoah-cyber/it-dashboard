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
  critical: { label: "立即處理", color: "#B42318", background: "#FEF3F2" },
  high: { label: "優先處理", color: "#B54708", background: "#FFFAEB" },
  medium: { label: "待留意", color: "#175CD3", background: "#EFF8FF" },
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
    eyebrow: "TAROKO · MIS · 今日摘要",
    title: (summary) => summary.total ? `${summary.total} 件工作與行程` : "今日一切正常",
    subtitle: "通知中心與今日行程"
  },
  critical_event: {
    eyebrow: "TAROKO · MIS · 即時通知",
    title: (summary) => `${summary.critical} 件需要立即處理`,
    subtitle: "剛進入重大狀態"
  },
  critical_follow_up: {
    eyebrow: "TAROKO · MIS · 下午追催",
    title: (summary) => `${summary.critical} 件重大事項尚未完成`,
    subtitle: "已讀事項仍會持續提醒"
  },
  manual: {
    eyebrow: "TAROKO · MIS",
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

function flexStat(label, value, color, background) {
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    backgroundColor: background,
    cornerRadius: "10px",
    paddingAll: "10px",
    contents: [
      { type: "text", text: String(value), size: "xl", weight: "bold", color, align: "center" },
      { type: "text", text: label, size: "xs", color: "#667085", align: "center", margin: "xs" }
    ]
  };
}

function flexNotificationRow(item, today, isLast) {
  const severity = LINE_SEVERITY_META[item.severity] || LINE_SEVERITY_META.medium;
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
        { type: "text", text: item.category_label, size: "xs", color: "#667085", margin: "sm", flex: 0 },
        { type: "text", text: lineDueLabel(item, today), size: "xs", color: severity.color, align: "end", flex: 1 }
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
    }
  ];
  if (item.description) {
    contents.push({
      type: "text",
      text: oneLine(item.description, 76),
      size: "xs",
      color: "#667085",
      wrap: true,
      maxLines: 1,
      margin: "xs"
    });
  }
  return {
    type: "box",
    layout: "vertical",
    paddingTop: "14px",
    paddingBottom: isLast ? "4px" : "14px",
    borderWidth: isLast ? "none" : "1px",
    borderColor: "#EAECF0",
    contents
  };
}

export function buildNotificationLineFlexMessage(items, today, appUrl = "", options = {}) {
  const rows = items || [];
  const summaryRows = Array.isArray(options.summaryItems) ? options.summaryItems : rows;
  const summary = lineSummary(summaryRows);
  const visible = rows.slice(0, 5);
  const hasCritical = summary.critical > 0;
  const mode = LINE_MESSAGE_MODES[options.mode] || LINE_MESSAGE_MODES.manual;
  const isAllClear = options.mode === "daily_digest" && summary.total === 0;
  const recentCount = Math.max(0, Number(options.recentCount) || 0);
  const headerColor = isAllClear ? "#15705A" : hasCritical ? "#8E2C25" : summary.high ? "#9A4D0A" : "#173F5F";
  const centerUrl = absoluteAppUrl(appUrl);
  const primaryItemUrl = rows.length === 1 ? absoluteAppUrl(appUrl, rows[0]?.href) : "";
  const categoryLine = categorySummary(summary) || "目前沒有待處理事項";
  const bodyContents = [
    {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        flexStat("立即", summary.critical, "#B42318", "#FEF3F2"),
        flexStat("優先", summary.high, "#B54708", "#FFFAEB"),
        flexStat("全部", summary.total, "#175CD3", "#EFF8FF")
      ]
    },
    { type: "text", text: categoryLine, size: "xs", color: "#667085", wrap: true, margin: "md" },
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
      { type: "separator", margin: "lg", color: "#D0D5DD" },
      ...visible.map((item, index) => flexNotificationRow(item, today, index === visible.length - 1))
    ]),
    ...(!isAllClear && !visible.length && recentCount ? [{
      type: "text",
      text: `${recentCount} 件已於最近 4 小時通知，本次不重複列出`,
      size: "xs",
      color: "#667085",
      align: "center",
      margin: "lg",
      wrap: true
    }] : []),
    ...(rows.length > visible.length ? [{
      type: "text",
      text: `另有 ${rows.length - visible.length} 件未顯示，請至通知中心查看`,
      size: "xs",
      color: "#667085",
      align: "center",
      margin: "lg",
      wrap: true
    }] : [])
  ];
  const footerContents = [];
  if (primaryItemUrl) {
    footerContents.push({
      type: "button",
      style: "secondary",
      height: "sm",
      action: { type: "uri", label: "查看這筆事項", uri: primaryItemUrl }
    });
  }
  if (centerUrl) {
    footerContents.push({
      type: "button",
      style: "primary",
      height: "sm",
      color: "#15705A",
      ...(footerContents.length ? { margin: "sm" } : {}),
      action: { type: "uri", label: `開啟通知中心（${summary.total}）`, uri: centerUrl }
    });
  }

  const altText = isAllClear
    ? `今日工作摘要｜${today}｜今日一切正常`
    : firstCharacters(`${mode.title(summary)}｜${today}\n${buildNotificationLineMessage(summaryRows, today, appUrl)}`, 400);
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
        paddingAll: "20px",
        contents: [
          { type: "text", text: mode.eyebrow, size: "xxs", weight: "bold", color: "#FFFFFFCC" },
          {
            type: "text",
            text: mode.title(summary),
            size: "xl",
            weight: "bold",
            color: "#FFFFFF",
            wrap: true,
            margin: "sm"
          },
          { type: "text", text: `${today}  ·  ${mode.subtitle}`, size: "xs", color: "#FFFFFFCC", margin: "sm" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: bodyContents
      },
      ...(footerContents.length ? {
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingAll: "16px",
          paddingTop: "4px",
          contents: footerContents
        }
      } : {})
    }
  };
}
