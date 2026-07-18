const MONEY_EMPTY = new Set(["", "-", "--", "—", "–", "－"]);

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseMoney(value) {
  if (value === null || value === undefined) return { value: null, empty: true, error: null };
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { value: roundCurrency(value), empty: false, error: null }
      : { value: null, empty: false, error: "不是有效金額" };
  }

  if (typeof value === "object") {
    if (value instanceof Date) return { value: null, empty: false, error: "日期不可作為金額" };
    if (value.error) return { value: null, empty: false, error: `Excel 錯誤 ${value.error}` };
    if (Object.hasOwn(value, "result")) return parseMoney(value.result);
  }

  let text = String(value).trim();
  if (MONEY_EMPTY.has(text)) return { value: null, empty: true, error: null };
  if (/^#(?:REF|VALUE|DIV\/0|N\/A|NAME|NUM|NULL)!?$/i.test(text)) {
    return { value: null, empty: false, error: `Excel 錯誤 ${text}` };
  }

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text
    .replace(/[\s,，]/g, "")
    .replace(/^(?:NT\$|TWD|NTD|\$)/i, "")
    .replace(/(?:元|圓)$/u, "");

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return { value: null, empty: false, error: "不是有效金額" };
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return { value: null, empty: false, error: "不是有效金額" };
  return { value: roundCurrency(negative ? -Math.abs(number) : number), empty: false, error: null };
}

export function parseExcelDate(value, { date1904 = false } = {}) {
  if (value === null || value === undefined || value === "") return { value: null, error: null };
  if (typeof value === "object") {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return { value: value.toISOString().slice(0, 10), error: null };
    }
    if (value.error) return { value: null, error: `Excel 錯誤 ${value.error}` };
    if (Object.hasOwn(value, "result")) return parseExcelDate(value.result, { date1904 });
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30);
    const date = new Date(epoch + Math.round(value * 86400000));
    return Number.isFinite(date.getTime())
      ? { value: date.toISOString().slice(0, 10), error: null }
      : { value: null, error: "不是有效 Excel 日期" };
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{2,4})[./-](\d{1,2})[./-](\d{1,2})(?:\s.*)?$/);
  if (!match) return { value: null, error: "不是可辨識日期" };
  let year = Number(match[1]);
  if (year >= 100 && year < 200) year += 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return { value: null, error: "日期不存在" };
  return { value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, error: null };
}

export function budgetExecutionStatus(budgetAmount, actualAmount, committedAmount = 0) {
  const budget = Number(budgetAmount || 0);
  const used = Number(actualAmount || 0) + Number(committedAmount || 0);
  const available = roundCurrency(budget - used);
  const rate = budget > 0 ? (used / budget) * 100 : used > 0 ? Number.POSITIVE_INFINITY : 0;
  if (available < 0 || rate > 100) return { key: "over", label: "超支", icon: "!", rate, available };
  if (rate >= 90) return { key: "near", label: "接近用罄", icon: "▲", rate, available };
  if (rate >= 70) return { key: "attention", label: "注意", icon: "△", rate, available };
  return { key: "normal", label: "正常", icon: "✓", rate, available };
}

export function summarizeBudget(items, monthlyAmounts, throughMonth = 12) {
  const month = Math.min(12, Math.max(1, Number(throughMonth) || 12));
  const actualByItem = new Map();
  for (const entry of monthlyAmounts || []) {
    if (Number(entry.actual_month ?? entry.actualMonth) > month) continue;
    const key = entry.budget_item_id ?? entry.budgetItemId ?? entry.item_source_key ?? entry.itemSourceKey;
    actualByItem.set(key, (actualByItem.get(key) || 0) + Number(entry.amount || 0));
  }
  return (items || []).reduce((summary, item) => {
    const key = item.id ?? item.source_key ?? item.sourceKey;
    const budget = Number(item.budget_amount ?? item.budgetAmount ?? 0);
    const committed = Number(item.committed_amount ?? item.committedAmount ?? 0);
    const actual = actualByItem.get(key) || 0;
    summary.budget += budget;
    summary.actual += actual;
    summary.committed += committed;
    return summary;
  }, { budget: 0, actual: 0, committed: 0 });
}
