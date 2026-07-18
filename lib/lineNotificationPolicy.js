const TAIPEI_TIME_ZONE = "Asia/Taipei";

const TAIPEI_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TAIPEI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  weekday: "short"
});

export function taipeiDateTimeParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  const parts = Object.fromEntries(
    TAIPEI_PARTS_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

export function isWeekdayDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const weekday = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function isTaipeiWeekday(value = new Date()) {
  return isWeekdayDateKey(taipeiDateTimeParts(value).date);
}

export function isTaipeiBusinessTime(value = new Date()) {
  const parts = taipeiDateTimeParts(value);
  return isWeekdayDateKey(parts.date) && parts.hour >= 8 && parts.hour < 18;
}

export function selectNewCriticalItems(beforeItems = [], afterItems = []) {
  const previousCriticalKeys = new Set(
    beforeItems.filter((item) => item?.severity === "critical").map((item) => String(item.key))
  );
  return afterItems.filter(
    (item) => item?.severity === "critical" && !previousCriticalKeys.has(String(item.key))
  );
}

export function selectActiveNotificationItems(items = [], { criticalOnly = false } = {}) {
  return items.filter((item) => {
    if (!item || item.is_snoozed) return false;
    return !criticalOnly || item.severity === "critical";
  });
}

export function excludeRecentlyPushedItems(items = [], recentKeys = new Set()) {
  const keys = recentKeys instanceof Set ? recentKeys : new Set(recentKeys || []);
  return items.filter((item) => !keys.has(String(item?.key || "")));
}

export function notificationItemCounts(items = []) {
  return items.reduce((counts, item) => {
    counts.total += 1;
    counts[item.severity] = (counts[item.severity] || 0) + 1;
    counts.categories[item.source_type] = (counts.categories[item.source_type] || 0) + 1;
    return counts;
  }, { total: 0, critical: 0, high: 0, medium: 0, low: 0, categories: {} });
}

export function isRetryableLineStatus(status) {
  return Number(status) >= 500 && Number(status) <= 599;
}
