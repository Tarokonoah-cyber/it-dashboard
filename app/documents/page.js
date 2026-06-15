"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { getField } from "../../components/DataSectionPage";

const EMPTY = "未填寫";
const STATUS_FILTERS = [
  { label: "缺金額", value: "missing_amount" },
  { label: "缺部門", value: "missing_department" },
  { label: "缺單據內容", value: "missing_content" },
  { label: "有備註", value: "has_note" },
  { label: "資料需補齊", value: "incomplete" }
];
const DOCUMENT_TYPES = ["請款單", "發票", "收據", "合約", "其他"];
const DEPARTMENTS = ["MIS", "ACC", "FO", "FB", "EO", "REC", "HK", "SEC", "HR", "ENG", "RV", "SPA"];

const DOCUMENT_KEYS = {
  date: ["日期", "date", "doc_date", "?交?", "æ¥æ"],
  month: ["月份", "month", "doc_month", "?遢", "æä»½"],
  department: ["部門", "department", "cost_owner", "costOwner", "cost_center", "?券?", "?甇詨惇", "é¨é"],
  content: ["單據內容", "receipt_content", "document_content", "category", "item_category", "?格??批捆", "å®ææ ¼å¼"],
  description: ["項目說明", "description", "?隤芣?", "é \u0085ç®èªªæ"],
  amount: ["金額", "amount", "total_amount", "??", "蝮賡?憿?", "ç¸½éé¡"],
  format: ["單據格式", "document_type", "format", "?格??澆?", "å®ææ ¼å¼"],
  vendor: ["供應商", "vendor", "靘??", "ä¾æå"],
  note: ["備註", "note", "?酉", "åè¨»"],
  updatedAt: ["最後更新時間", "source_updated_at", "updated_at", "?敺?唳??", "æå¾æ´æ°æé"]
};

function text(...values) {
  for (const value of values) {
    const normalized = value === null || value === undefined ? "" : String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function dateKey(value) {
  return text(value).slice(0, 10);
}

function monthKey(row, date) {
  const explicit = text(getField(row, DOCUMENT_KEYS.month));
  if (explicit) {
    if (/^\d{4}-\d{2}/.test(explicit)) return explicit.slice(0, 7);
    return explicit;
  }
  return date ? date.slice(0, 7) : "";
}

function parseAmount(value) {
  const raw = text(value);
  if (!raw) return null;
  const number = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeDocument(row) {
  const date = dateKey(getField(row, DOCUMENT_KEYS.date));
  const department = text(getField(row, DOCUMENT_KEYS.department));
  const content = text(getField(row, DOCUMENT_KEYS.content));
  const description = text(getField(row, DOCUMENT_KEYS.description));
  const amountText = text(getField(row, DOCUMENT_KEYS.amount));
  const amount = parseAmount(amountText);
  const note = text(getField(row, DOCUMENT_KEYS.note));

  return {
    id: text(row.id, row.record_key, getField(row, ["id", "record_key"]), `${date}-${department}-${content}`),
    date,
    month: monthKey(row, date),
    department,
    content,
    description,
    amount,
    amountText,
    format: text(getField(row, DOCUMENT_KEYS.format)),
    vendor: text(getField(row, DOCUMENT_KEYS.vendor)),
    note,
    updatedAt: dateKey(getField(row, DOCUMENT_KEYS.updatedAt)),
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

function splitDepartments(value) {
  return text(value)
    .split(/[,、，\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasStatus(row, status) {
  if (!status) return true;
  if (status === "missing_amount") return row.amount === null;
  if (status === "missing_department") return !row.department;
  if (status === "missing_content") return !row.content;
  if (status === "has_note") return Boolean(row.note);
  if (status === "incomplete") return !row.date || row.amount === null || !row.department || !row.content;
  return true;
}

function uniqueOptions(defaults, values) {
  return Array.from(new Set([...defaults, ...values.filter(Boolean)])).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function formatCurrency(value) {
  if (value === null) return "-";
  return `NT$${value.toLocaleString("en-US")}`;
}

function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function initialForm() {
  return {
    date: todayTaipei(),
    cost_center: DEPARTMENTS[0],
    document_type: DOCUMENT_TYPES[0],
    description: "",
    total_amount: "",
    note: ""
  };
}

function DocumentModal({ form, setForm, onClose, onSubmit, saving }) {
  return (
    <div className="documents-modal-backdrop" onMouseDown={onClose}>
      <form className="documents-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>新增單據</h2>
            <p>新增後會寫入 documents API。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="documents-form-grid">
          <label>
            <span>日期</span>
            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
          </label>
          <label>
            <span>部門</span>
            <select value={form.cost_center} onChange={(event) => setForm((current) => ({ ...current, cost_center: event.target.value }))} required>
              {DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}
            </select>
          </label>
          <label>
            <span>單據格式</span>
            <select value={form.document_type} onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))} required>
              {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>金額</span>
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
  const [filters, setFilters] = useState({ month: "", department: "", content: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/records?source=documents");
      setRows((data.rows || []).map(normalizeDocument));
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
      months: uniqueOptions([], rows.map((row) => row.month)),
      departments: uniqueOptions(DEPARTMENTS, departments),
      contents: uniqueOptions([], rows.map((row) => row.content || EMPTY))
    };
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filters.month && row.month !== filters.month) return false;
    if (filters.department && !splitDepartments(row.department).includes(filters.department)) return false;
    if (filters.content && (row.content || EMPTY) !== filters.content) return false;
    if (filters.status && !hasStatus(row, filters.status)) return false;
    return true;
  }), [rows, filters]);

  const totalAmount = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (row.amount || 0), 0),
    [filteredRows]
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function submitDocument(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/records", {
        method: "POST",
        body: JSON.stringify({ source: "documents", ...form, month: form.date.slice(0, 7) })
      });
      setShowForm(false);
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
            <p>追蹤各部門送交單據、金額與補件狀態。</p>
          </div>
          <div className="documents-header-actions">
            <button className="primary" type="button" onClick={() => setShowForm(true)}>新增單據</button>
            <button type="button" onClick={load} disabled={loading}>{loading ? "重新整理中..." : "重新整理"}</button>
          </div>
        </header>

        <section className="documents-toolbar">
          <div className="documents-summary">
            <span>資料筆數 <strong>{filteredRows.length}</strong></span>
            <span>總金額 <strong>{formatCurrency(totalAmount)}</strong></span>
          </div>
          <label>
            <span>月份</span>
            <select value={filters.month} onChange={(event) => updateFilter("month", event.target.value)}>
              <option value="">全部</option>
              {options.months.map((month) => <option key={month}>{month}</option>)}
            </select>
          </label>
          <label>
            <span>部門</span>
            <select value={filters.department} onChange={(event) => updateFilter("department", event.target.value)}>
              <option value="">全部</option>
              {options.departments.map((department) => <option key={department}>{department}</option>)}
            </select>
          </label>
          <label>
            <span>單據內容</span>
            <select value={filters.content} onChange={(event) => updateFilter("content", event.target.value)}>
              <option value="">全部</option>
              {options.contents.map((content) => <option key={content}>{content}</option>)}
            </select>
          </label>
          <label>
            <span>狀態</span>
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">全部</option>
              {STATUS_FILTERS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setFilters({ month: "", department: "", content: "", status: "" })}>清除</button>
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
                    <th>日期</th>
                    <th>部門</th>
                    <th>單據內容</th>
                    <th>項目說明</th>
                    <th>金額</th>
                    <th>單據格式</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date || "-"}</td>
                      <td>{row.department || "-"}</td>
                      <td>{row.content || EMPTY}</td>
                      <td className="wrap">{row.description || "-"}</td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td>{row.format || "-"}</td>
                      <td><button type="button" onClick={() => window.alert("詳細檢視功能尚未串接。")}>檢視</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {showForm ? (
          <DocumentModal
            form={form}
            setForm={setForm}
            onClose={() => setShowForm(false)}
            onSubmit={submitDocument}
            saving={saving}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
