"use client";

import { useEffect } from "react";

const SYSTEM_KEYWORDS = ["id", "created_at", "updated_at", "source_record_id", "record_key", "source_key"];
const SYSTEM_LABELS = new Set(["編號", "最後更新", "更新時間"]);
const DATE_LABELS = new Set(["開始日", "到期日", "最後更新", "更新時間"]);
const TEXTAREA_LABELS = new Set(["備註", "碳粉/墨水"]);
const SELECT_LABELS = new Set(["部門", "使用部門", "狀態", "盤點狀態", "資產狀態", "防毒", "防毒狀態", "資產類型", "類型", "電信商"]);

export function rowIdentity(row) {
  return row?.id || row?.record_key || row?.__tempId || "";
}

export function cloneRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    data: { ...(row.data || {}) }
  }));
}

export function isEditableColumn(column) {
  if (column?.editable === false) return false;
  if (SYSTEM_LABELS.has(column?.label)) return false;
  return !(column?.keys || []).some((key) => SYSTEM_KEYWORDS.includes(String(key).toLowerCase()));
}

export function fieldKeyForColumn(row, column) {
  const data = row?.data || {};
  const keys = column?.keys || [];
  const existing = keys.find((key) => Object.prototype.hasOwnProperty.call(data, key));
  if (existing) return existing;
  const canonical = keys.find((key) => /^[a-z][a-z0-9_]*$/i.test(String(key)));
  return canonical || keys[0] || column?.label;
}

export function getDraftValue(row, column) {
  return row?.data?.[fieldKeyForColumn(row, column)] ?? "";
}

export function setDraftValue(rows, rowKey, column, value) {
  return rows.map((row) => {
    if (rowIdentity(row) !== rowKey) return row;
    const fieldKey = fieldKeyForColumn(row, column);
    return {
      ...row,
      data: {
        ...(row.data || {}),
        [fieldKey]: value
      }
    };
  });
}

export function hasDraftChanges(baseRows, draftRows) {
  const baseByKey = new Map((baseRows || []).map((row) => [rowIdentity(row), row]));
  return (draftRows || []).some((row) => {
    if (row.__isNew) return true;
    const base = baseByKey.get(rowIdentity(row));
    return JSON.stringify(base?.data || {}) !== JSON.stringify(row.data || {});
  });
}

export function changedRows(baseRows, draftRows) {
  const baseByKey = new Map((baseRows || []).map((row) => [rowIdentity(row), row]));
  return (draftRows || []).filter((row) => {
    if (row.__isNew) return true;
    const base = baseByKey.get(rowIdentity(row));
    return JSON.stringify(base?.data || {}) !== JSON.stringify(row.data || {});
  });
}

export function blankDraftRow(columns, source) {
  const data = {};
  columns.filter(isEditableColumn).forEach((column) => {
    data[fieldKeyForColumn({ data: {} }, column)] = column.defaultValue || "";
  });
  return {
    id: "",
    __tempId: `new-${source}-${Date.now()}`,
    __isNew: true,
    source_key: source,
    source_label: source,
    record_key: "",
    data
  };
}

export function inputTypeForColumn(column) {
  if (DATE_LABELS.has(column?.label)) return "date";
  return "text";
}

export function isTextareaColumn(column) {
  return TEXTAREA_LABELS.has(column?.label);
}

export function isSelectColumn(column) {
  return SELECT_LABELS.has(column?.label);
}

export function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export function optionsForColumn(rows, column) {
  if (Array.isArray(column?.options) && column.options.length) return column.options;
  const values = (rows || [])
    .map((row) => String(getDraftValue(row, column) || "").trim())
    .filter(Boolean);
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

export function useUnsavedChangesWarning(active) {
  useEffect(() => {
    if (!active) return undefined;
    const message = "尚未儲存的修改將會遺失，確定要離開嗎？";
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.addEventListener("beforeunload", beforeUnload);
    window.history.pushState = function pushStateWithConfirm(...args) {
      if (window.confirm(message)) return originalPushState.apply(this, args);
      return undefined;
    };
    window.history.replaceState = function replaceStateWithConfirm(...args) {
      if (window.confirm(message)) return originalReplaceState.apply(this, args);
      return undefined;
    };
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [active]);
}
