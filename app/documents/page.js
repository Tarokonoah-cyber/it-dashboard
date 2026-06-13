"use client";

import { useEffect, useMemo, useState } from "react";

const EMPTY = "未分類";
const STATUS_FILTERS = ["待補金額", "待補部門", "待補單據內容", "有備註", "異常資料"];
const DOCUMENT_TYPES = ["零用金支付憑證", "支票請求單", "用印申請書", "借據", "採購單"];
const DEPARTMENTS = ["MIS", "ACC", "FO", "FB", "EO", "REC", "HK", "SEC", "HR", "ENG", "RV", "SPA"];

function text(...values) {
  for (const value of values) {
    const normalized = value === null || value === undefined ? "" : String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function dataOf(row) {
  return row?.data || row || {};
}

function dateKey(value) {
  return text(value).slice(0, 10);
}

function monthKey(row, date) {
  const explicit = text(row.month, row.doc_month, row["月份"]);
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
  const data = dataOf(row);
  const date = dateKey(data.date || data.doc_date || data["日期"]);
  const department = text(
    data.department,
    data.cost_owner,
    data.costOwner,
    data.cost_center,
    data["部門"],
    data["成本歸屬"]
  );
  const content = text(
    data.receipt_content,
    data.document_content,
    data.category,
    data.item_category,
    data["單據內容"]
  );
  const amountText = text(data.amount, data.total_amount, data["金額"], data["總金額"]);
  const amount = parseAmount(amountText);
  const note = text(data.note, data["備註"]);

  return {
    id: text(row.id, row.record_key, data.id, data.record_key, `${date}-${department}-${content}`),
    date,
    month: monthKey(data, date),
    department,
    content,
    description: text(data.description, data["項目說明"]),
    amount,
    amountText,
    format: text(data.document_type, data.format, data["單據格式"]),
    note,
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
  if (!response.ok || data.success === false) throw new Error(data.message || "讀取失敗");
  return data.data;
}

function splitDepartments(value) {
  return text(value)
    .split(/[,，、/\\\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasStatus(row, status) {
  if (!status) return true;
  if (status === "待補金額") return row.amount === null;
  if (status === "待補部門") return !row.department;
  if (status === "待補單據內容") return !row.content;
  if (status === "有備註") return Boolean(row.note);
  if (status === "異常資料") return !row.date || row.amount === null || !row.department || !row.content;
  return true;
}

function uniqueOptions(defaults, values) {
  return Array.from(new Set([...defaults, ...values.filter(Boolean)])).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function formatCurrency(value) {
  if (value === null) return "-";
  return `NT$${value.toLocaleString("en-US")}`;
}

function DocumentModal({ form, setForm, onClose, onSubmit, saving }) {
  return (
    <div className="documents-modal-backdrop" onMouseDown={onClose}>
      <form className="documents-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>新增單據</h2>
            <p>寫入現有 documents API</p>
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
          <button className="primary" type="submit" disabled={saving}>{saving ? "儲存中" : "儲存"}</button>
        </footer>
      </form>
    </div>
  );
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
    <main className="documents-page">
      <header className="documents-header">
        <div>
          <h1>送交單據紀錄</h1>
          <p>原 Sheet：送交單據紀錄表</p>
        </div>
        <div className="documents-header-actions">
          <button className="primary" type="button" onClick={() => setShowForm(true)}>新增單據</button>
          <button type="button" onClick={load} disabled={loading}>{loading ? "刷新中" : "刷新"}</button>
        </div>
      </header>

      <section className="documents-toolbar">
        <div className="documents-summary">
          <span>文件筆數 <strong>{filteredRows.length}</strong></span>
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
            {STATUS_FILTERS.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setFilters({ month: "", department: "", content: "", status: "" })}>清除</button>
      </section>

      {error ? <div className="documents-alert">{error}</div> : null}

      <section className="documents-table-card">
        {loading ? <div className="documents-empty">正在讀取單據紀錄...</div> : null}
        {!loading && filteredRows.length === 0 ? <div className="documents-empty">目前沒有符合條件的單據。</div> : null}
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
                    <td><button type="button" onClick={() => window.alert("明細檢視下一階段補上")}>檢視</button></td>
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
    </main>
  );
}
