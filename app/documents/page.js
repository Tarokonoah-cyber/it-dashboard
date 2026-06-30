"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { getField } from "../../components/DataSectionPage";

const EMPTY = "未提供";
const DOCUMENT_TYPES = ["零用金支付憑證", "用印申請書", "採購單", "支票請求單"];
const DEPARTMENTS = ["MIS", "ACC", "FO", "FB", "EO", "REC", "HK", "SEC", "HR", "ENG", "RV", "SPA"];

const DOCUMENT_KEYS = {
  id: ["id", "record_key"],
  date: ["日期", "date", "doc_date", "æ¥æ"],
  month: ["月份", "month", "doc_month", "æä»½"],
  department: ["成本歸屬", "部門", "department", "cost_owner", "costOwner", "cost_center", "ææ¬æ­¸å±¬", "é¨é"],
  description: ["項目說明", "description", "é \u0085ç®èªªæ"],
  amount: ["總金額", "金額", "amount", "total_amount", "ç¸½éé¡"],
  format: ["單據格式", "document_type", "format", "å®ææ ¼å¼"],
  vendor: ["供應商", "vendor", "ä¾æå"],
  note: ["備註", "note", "åè¨»"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt", "最後更新時間", "source_updated_at", "æå¾æ´æ°æé"]
};

function text(...values) {
  for (const value of values) {
    const normalized = value === null || value === undefined ? "" : String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function dateKey(value) {
  const raw = text(value).slice(0, 10);
  const match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return raw;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function displayMonthFromDate(value) {
  const match = text(value).match(/^\d{4}[/-](\d{1,2})/);
  if (!match) return "";
  return `${Number(match[1])}月`;
}

function yearMonthFromDate(value) {
  const match = text(value).match(/^(\d{4})[/-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

function normalizeMonth(value, date) {
  const explicit = text(value);
  if (explicit) {
    const yearMonth = explicit.match(/^\d{4}[/-](\d{1,2})/);
    if (yearMonth) return `${Number(yearMonth[1])}月`;
    const monthLabel = explicit.match(/^(\d{1,2})\s*月$/);
    if (monthLabel) return `${Number(monthLabel[1])}月`;
    const numeric = explicit.match(/^(\d{1,2})$/);
    if (numeric) return `${Number(numeric[1])}月`;
    return explicit;
  }
  return displayMonthFromDate(date);
}

function monthKey(row, date) {
  return normalizeMonth(getField(row, DOCUMENT_KEYS.month), date);
}

function parseAmount(value) {
  const raw = text(value);
  if (!raw) return 0;
  const number = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function timestampValue(value) {
  const raw = text(value);
  if (!raw) return 0;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function splitDepartments(value) {
  return text(value)
    .split(/[,\u3001/|;；、\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compareDocuments(a, b) {
  const dateCompare = b.date.localeCompare(a.date);
  if (dateCompare !== 0) return dateCompare;

  const createdCompare = timestampValue(b.createdAt) - timestampValue(a.createdAt);
  if (createdCompare !== 0) return createdCompare;

  const updatedCompare = timestampValue(b.updatedAt) - timestampValue(a.updatedAt);
  if (updatedCompare !== 0) return updatedCompare;

  return String(b.id).localeCompare(String(a.id));
}

function normalizeDocument(row) {
  const date = dateKey(getField(row, DOCUMENT_KEYS.date));
  const department = text(getField(row, DOCUMENT_KEYS.department));
  const description = text(getField(row, DOCUMENT_KEYS.description));
  const amountText = text(getField(row, DOCUMENT_KEYS.amount));
  const createdAt = text(getField(row, DOCUMENT_KEYS.createdAt), row.created_at);
  const updatedAt = text(getField(row, DOCUMENT_KEYS.updatedAt), row.updated_at);

  return {
    id: text(row.id, getField(row, DOCUMENT_KEYS.id), `${date}-${department}-${description}`),
    recordKey: text(row.record_key, getField(row, "record_key")),
    date,
    month: monthKey(row, date),
    yearMonth: yearMonthFromDate(date),
    vendor: text(getField(row, DOCUMENT_KEYS.vendor)),
    department,
    description,
    amount: parseAmount(amountText),
    amountText,
    format: text(getField(row, DOCUMENT_KEYS.format)),
    note: text(getField(row, DOCUMENT_KEYS.note)),
    createdAt,
    updatedAt,
    source: row
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || "資料讀取失敗");
  return data.data;
}

function uniqueOptions(defaults, values, sortDesc = false) {
  const options = Array.from(new Set([...defaults, ...values.map(text).filter(Boolean)]));
  return options.sort((a, b) => sortDesc ? b.localeCompare(a, "zh-Hant") : a.localeCompare(b, "zh-Hant"));
}

function formatCurrency(value) {
  return `NT$${Number(value || 0).toLocaleString("en-US")}`;
}

function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function currentMonthTaipei() {
  return todayTaipei().slice(0, 7);
}

function initialForm(row) {
  return {
    id: row?.id || "",
    date: row?.date || todayTaipei(),
    vendor: row?.vendor || "",
    cost_center: row?.department || DEPARTMENTS[0],
    document_type: DOCUMENT_TYPES.includes(row?.format) ? row.format : DOCUMENT_TYPES[0],
    description: row?.description || "",
    total_amount: row?.amountText || (row?.amount ? String(row.amount) : ""),
    note: row?.note || ""
  };
}

function StatCard({ label, value }) {
  return (
    <div className="documents-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DepartmentBadges({ value }) {
  const departments = splitDepartments(value);
  if (!departments.length) return <span className="documents-muted">{EMPTY}</span>;
  return (
    <div className="documents-badge-list">
      {departments.map((department) => (
        <span className="documents-department-badge" key={department}>{department}</span>
      ))}
    </div>
  );
}

function DocumentTypePill({ value }) {
  const label = value || EMPTY;
  const tone = DOCUMENT_TYPES.indexOf(label);
  return <span className={`documents-format-pill tone-${tone >= 0 ? tone % 4 : "neutral"}`}>{label}</span>;
}

function DocumentModal({ mode, form, setForm, onClose, onSubmit, saving }) {
  return (
    <div className="documents-modal-backdrop" onMouseDown={onClose}>
      <form className="documents-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>{mode === "edit" ? "編輯單據" : "新增單據"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </header>
        <div className="documents-form-grid">
          <label>
            <span>日期</span>
            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
          </label>
          <label>
            <span>供應商</span>
            <input value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
          </label>
          <label>
            <span>成本歸屬</span>
            <select value={form.cost_center} onChange={(event) => setForm((current) => ({ ...current, cost_center: event.target.value }))} required>
              {uniqueOptions(DEPARTMENTS, [form.cost_center]).map((department) => <option key={department}>{department}</option>)}
            </select>
          </label>
          <label>
            <span>單據格式</span>
            <select value={form.document_type} onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))} required>
              {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>總金額</span>
            <input type="number" min="0" step="1" value={form.total_amount} onChange={(event) => setForm((current) => ({ ...current, total_amount: event.target.value }))} />
          </label>
          <label className="wide">
            <span>項目說明</span>
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
          </label>
          <label className="wide">
            <span>備註</span>
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" type="submit" disabled={saving}>{saving ? "儲存中..." : "儲存"}</button>
        </footer>
      </form>
    </div>
  );
}

export default function DocumentsPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ search: "", month: "", department: "", format: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState("");
  const [form, setForm] = useState(() => initialForm());

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/records?source=documents");
      setRows((data.rows || []).map(normalizeDocument).sort(compareDocuments));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const options = useMemo(() => {
    const departments = rows.flatMap((row) => splitDepartments(row.department));
    return {
      months: uniqueOptions([], rows.map((row) => row.month), true),
      departments: uniqueOptions(DEPARTMENTS, departments),
      formats: DOCUMENT_TYPES
    };
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const keyword = filters.search.trim().toLowerCase();
    if (keyword) {
      const haystack = `${row.description} ${row.vendor}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (filters.month && row.month !== filters.month) return false;
    if (filters.department && !splitDepartments(row.department).includes(filters.department)) return false;
    if (filters.format && row.format !== filters.format) return false;
    return true;
  }).sort(compareDocuments), [rows, filters]);

  const stats = useMemo(() => {
    const currentMonth = currentMonthTaipei();
    const currentMonthLabel = displayMonthFromDate(todayTaipei());
    const vendors = new Set(filteredRows.map((row) => row.vendor).filter(Boolean));
    const amount = filteredRows.reduce((sum, row) => sum + row.amount, 0);
    return {
      total: filteredRows.length.toLocaleString("en-US"),
      month: filteredRows
        .filter((row) => (row.yearMonth ? row.yearMonth === currentMonth : row.month === currentMonthLabel))
        .length
        .toLocaleString("en-US"),
      vendors: vendors.size.toLocaleString("en-US"),
      amount: formatCurrency(amount)
    };
  }, [filteredRows]);

  const hasFilters = Boolean(filters.search || filters.month || filters.department || filters.format);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setForm(initialForm());
    setModalMode("create");
  }

  function openEdit(row) {
    setForm(initialForm(row));
    setModalMode("edit");
  }

  function closeModal() {
    if (saving) return;
    setModalMode("");
  }

  async function submitDocument(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = modalMode === "edit" ? "PATCH" : "POST";
      await api("/api/records", {
        method,
        body: JSON.stringify({ source: "documents", ...form })
      });
      setModalMode("");
      setForm(initialForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeSection="documents" title="送交單據紀錄">
      <div className="documents-page">
        <header className="documents-header">
          <div>
            <h1>送交單據紀錄</h1>
          </div>
          <div className="documents-header-actions">
            <button className="primary" type="button" onClick={openCreate}>新增單據</button>
            <button type="button" onClick={load} disabled={loading}>{loading ? "重新整理中..." : "重新整理"}</button>
          </div>
        </header>

        <section className="documents-overview">
          <div className="documents-stat-grid">
            <StatCard label="總筆數" value={stats.total} />
            <StatCard label="本月筆數" value={stats.month} />
            <StatCard label="供應商數" value={stats.vendors} />
            <StatCard label="已登錄金額" value={stats.amount} />
          </div>
        </section>

        <section className="documents-toolbar">
          <label className="documents-search">
            <span>搜尋</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="搜尋項目說明"
            />
          </label>
          <label>
            <span>月份</span>
            <select value={filters.month} onChange={(event) => updateFilter("month", event.target.value)}>
              <option value="">全部月份</option>
              {options.months.map((month) => <option key={month}>{month}</option>)}
            </select>
          </label>
          <label>
            <span>部門</span>
            <select value={filters.department} onChange={(event) => updateFilter("department", event.target.value)}>
              <option value="">全部部門</option>
              {options.departments.map((department) => <option key={department}>{department}</option>)}
            </select>
          </label>
          <label>
            <span>單據格式</span>
            <select value={filters.format} onChange={(event) => updateFilter("format", event.target.value)}>
              <option value="">全部格式</option>
              {options.formats.map((format) => <option key={format}>{format}</option>)}
            </select>
          </label>
          <button
            className="documents-clear"
            type="button"
            disabled={!hasFilters}
            onClick={() => setFilters({ search: "", month: "", department: "", format: "" })}
          >
            清除條件
          </button>
        </section>

        {error ? <div className="documents-alert">{error}</div> : null}

        <section className="documents-table-card">
          {loading ? <div className="documents-empty">讀取單據資料中...</div> : null}
          {!loading && filteredRows.length === 0 ? <div className="documents-empty">目前沒有符合條件的單據資料</div> : null}
          {filteredRows.length > 0 ? (
            <div className="documents-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>月份</th>
                    <th className="documents-date-head">日期 ↓</th>
                    <th>供應商</th>
                    <th>成本歸屬</th>
                    <th>項目說明</th>
                    <th className="documents-number-head">總金額</th>
                    <th>單據格式</th>
                    <th className="documents-action-head">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="documents-month-cell">{row.month || EMPTY}</td>
                      <td className="documents-date-cell">{row.date || EMPTY}</td>
                      <td>{row.vendor || EMPTY}</td>
                      <td><DepartmentBadges value={row.department} /></td>
                      <td className="documents-description-cell">{row.description || EMPTY}</td>
                      <td className="documents-amount-cell">{formatCurrency(row.amount)}</td>
                      <td><DocumentTypePill value={row.format} /></td>
                      <td className="documents-action-cell">
                        <button type="button" onClick={() => openEdit(row)}>編輯</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {modalMode ? (
          <DocumentModal
            mode={modalMode}
            form={form}
            setForm={setForm}
            onClose={closeModal}
            onSubmit={submitDocument}
            saving={saving}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
