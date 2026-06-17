"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const OPEN_STATUSES = new Set(["未開始", "處理中", "延後", "未完成", "待處理"]);

const WORK_TYPES = ["例行工作", "維修", "專案", "特殊事件", "行政支援"];
const SYSTEMS = ["OPERA", "網路", "NAS", "印表機", "電腦", "Office", "門禁", "Google Workspace", "SOP", "其他"];
const IMPACT_SCOPES = ["個人", "部門", "全館", "住客"];
const STATUSES = ["未開始", "處理中", "已完成", "延後"];

function taipeiDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: taipeiDateKey(start),
    endDate: taipeiDateKey(end),
    workType: "",
    system: "",
    targetDepartment: "",
    status: ""
  };
}

function clean(value, fallback = "") {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

function dateKey(value) {
  return clean(value).slice(0, 10);
}

function normalizeBooleanText(value) {
  const text = clean(value);
  if (!text) return "";
  if (["true", "1", "yes", "y"].includes(text.toLowerCase())) return "是";
  if (["false", "0", "no", "n"].includes(text.toLowerCase())) return "否";
  return text;
}

function normalizeWork(row) {
  const workDate = dateKey(row.date || row.workDate || row.work_date || row.created_at);
  const status = clean(row.status, "未開始");
  const workType = clean(row.workType || row.work_type || row.category || row.type, "其他");
  const summary = clean(row.summary || row.title || row.description || row.subject || row.content, "未命名工作");
  const needFollowUp = normalizeBooleanText(row.needFollowUp || row.need_follow_up || row.follow_up);

  return {
    id: clean(row.id || row.record_key || `${workDate}-${summary}`),
    workDate,
    person: clean(row.person || row.staff || row.owner, "-"),
    summary,
    workType,
    system: clean(row.system || row.related_system || row.service || row.related_sop_name, "其他"),
    targetDepartment: clean(row.targetDepartment || row.target_department || row.department || row.service_scope || row.impact_scope, "未分類"),
    status,
    needFollowUp,
    impactLevel: clean(row.impactLevel || row.impact_level || row.impact, ""),
    businessImpact: normalizeBooleanText(row.businessImpact || row.business_impact),
    note: clean(row.note || row.remark || row.action || ""),
    raw: row
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

function isDone(record) {
  return DONE_STATUSES.has(clean(record.status));
}

function isFollowUp(record) {
  const follow = clean(record.needFollowUp).toLowerCase();
  return (
    !isDone(record) ||
    follow === "是" ||
    follow === "需追蹤" ||
    follow === "true" ||
    OPEN_STATUSES.has(clean(record.status))
  );
}

function isSpecial(record) {
  const text = [record.workType, record.summary, record.note, record.impactLevel, record.businessImpact].join(" ");
  return (
    record.workType === "特殊事件" ||
    /異常|故障|緊急|中斷|停機|客訴|事故|影響營運/.test(text)
  );
}

function filterRecords(records, filters) {
  return records.filter((record) => {
    if (filters.startDate && record.workDate < filters.startDate) return false;
    if (filters.endDate && record.workDate > filters.endDate) return false;
    if (filters.workType && record.workType !== filters.workType) return false;
    if (filters.system && record.system !== filters.system) return false;
    if (filters.targetDepartment && record.targetDepartment !== filters.targetDepartment) return false;
    if (filters.status && record.status !== filters.status) return false;
    return true;
  });
}

function countBy(records, key) {
  return records.reduce((map, record) => {
    const label = clean(record[key], "未分類");
    map[label] = (map[label] || 0) + 1;
    return map;
  }, {});
}

function uniqueOptions(defaults, records, key) {
  const values = records
    .map((record) => clean(record[key]))
    .filter(Boolean);
  return Array.from(new Set([...defaults, ...values]));
}

function buildKpi(records) {
  const total = records.length;
  const completed = records.filter(isDone).length;
  return {
    total,
    special: records.filter(isSpecial).length,
    followUp: records.filter(isFollowUp).length,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    workTypeStats: countBy(records, "workType"),
    systemStats: countBy(records, "system"),
    departmentStats: countBy(records, "targetDepartment"),
    statusStats: countBy(records, "status"),
    followList: records.filter(isFollowUp).slice(0, 30),
    records
  };
}

function toCsvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function exportCsv(records) {
  if (!records.length) {
    window.alert("目前沒有資料可以匯出");
    return;
  }

  const headers = ["日期", "人員", "工作摘要", "工作類型", "關聯項目", "影響範圍", "狀態", "是否需追蹤", "影響程度", "是否影響營運", "備註"];
  const rows = records.map((row) => [
    row.workDate,
    row.person,
    row.summary,
    row.workType,
    row.system,
    row.targetDepartment,
    row.status,
    row.needFollowUp,
    row.impactLevel,
    row.businessImpact,
    row.note
  ]);
  const csv = [headers, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `工作KPI_${taipeiDateKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, helper }) {
  return (
    <article className="boss-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="kpi-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StatBars({ title, subtitle, stats }) {
  const entries = Object.entries(stats || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <section className="boss-chart-card kpi-stat-card">
      <header>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </header>
      <div className="kpi-bar-list">
        {entries.length ? entries.map(([name, count]) => (
          <div className="kpi-bar-row" key={name}>
            <span>{name}</span>
            <i><em style={{ width: `${Math.round((count / max) * 100)}%` }} /></i>
            <b>{count}</b>
          </div>
        )) : <div className="boss-empty">目前沒有資料</div>}
      </div>
    </section>
  );
}

function FollowList({ rows }) {
  return (
    <section className="boss-report-section">
      <header>
        <h2>未完成 / 待追蹤事項</h2>
        <span>Top 30</span>
      </header>
      {rows.length ? (
        <div className="kpi-follow-list">
          {rows.map((row) => (
            <article key={row.id}>
              <strong>{row.summary}</strong>
              <span>{row.workDate} · {row.person} · {row.status} · {row.system}</span>
            </article>
          ))}
        </div>
      ) : <div className="boss-empty">目前沒有未完成或待追蹤事項。</div>}
    </section>
  );
}

function RecordsTable({ rows }) {
  const columns = [
    ["workDate", "日期"],
    ["person", "人員"],
    ["summary", "工作摘要"],
    ["workType", "工作類型"],
    ["system", "關聯項目"],
    ["targetDepartment", "影響範圍"],
    ["status", "狀態"],
    ["needFollowUp", "追蹤"],
    ["impactLevel", "影響程度"],
    ["businessImpact", "影響營運"],
    ["note", "備註"]
  ];

  return (
    <section className="boss-report-section">
      <header>
        <h2>工作明細</h2>
        <span>{rows.length} 筆</span>
      </header>
      {rows.length ? (
        <div className="kpi-records-table">
          <table>
            <thead>
              <tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map(([key]) => (
                    <td key={key} className={key === "summary" || key === "note" ? "wrap" : ""}>{row[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="boss-empty">目前沒有符合資料。</div>}
    </section>
  );
}

export default function BossKpiPage() {
  const [filters, setFilters] = useState(defaultRange);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/work-logs");
      setRecords((data.rows || []).map(normalizeWork));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);
  const kpi = useMemo(() => buildKpi(filteredRecords), [filteredRecords]);
  const filterOptions = useMemo(() => ({
    workTypes: uniqueOptions(WORK_TYPES, records, "workType"),
    systems: uniqueOptions(SYSTEMS, records, "system"),
    impactScopes: uniqueOptions(IMPACT_SCOPES, records, "targetDepartment"),
    statuses: uniqueOptions(STATUSES, records, "status")
  }), [records]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setMonthRange() {
    setFilters((current) => ({ ...current, ...defaultRange() }));
  }

  return (
    <AppShell activeSection="boss-kpi" title="工作 KPI">
      <div className="boss-kpi-page kpi-page">
      <header className="boss-kpi-hero kpi-hero">
        <div>
          <button className="boss-back no-print" onClick={() => { window.location.href = "/"; }}>返回工作中心</button>
          <p>Work KPI</p>
          <span>主管查看用，獨立頁面，不混在日常主選單。</span>
        </div>
        <div className="boss-kpi-actions">
          <button className="boss-kpi-export no-print" onClick={load} disabled={loading}>重新整理</button>
          <button className="boss-kpi-export no-print" onClick={() => exportCsv(kpi.records)}>匯出 CSV</button>
        </div>
      </header>

      <section className="boss-report-section kpi-filter-panel">
        <div className="kpi-filter-grid">
          <label className="kpi-filter-field">
            <span>開始日期</span>
            <input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} />
          </label>
          <label className="kpi-filter-field">
            <span>結束日期</span>
            <input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} />
          </label>
          <SelectField label="工作類型" value={filters.workType} onChange={(value) => setFilter("workType", value)} options={filterOptions.workTypes} />
          <SelectField label="關聯項目" value={filters.system} onChange={(value) => setFilter("system", value)} options={filterOptions.systems} />
          <SelectField label="影響範圍" value={filters.targetDepartment} onChange={(value) => setFilter("targetDepartment", value)} options={filterOptions.impactScopes} />
          <SelectField label="狀態" value={filters.status} onChange={(value) => setFilter("status", value)} options={filterOptions.statuses} />
        </div>
        <div className="kpi-filter-actions">
          <button onClick={load} disabled={loading}>查詢</button>
          <button onClick={setMonthRange}>本月</button>
        </div>
        {error ? <div className="boss-error">{error}</div> : null}
        {loading ? <div className="boss-empty">處理中，正在讀取工作 KPI...</div> : null}
      </section>

      <section className="boss-kpi-summary-grid">
        <MetricCard label="總工作件數" value={kpi.total} helper="篩選區間" />
        <MetricCard label="特殊事件" value={kpi.special} helper="異常 / 故障 / 緊急" />
        <MetricCard label="待追蹤" value={kpi.followUp} helper="未完成與需追蹤" />
        <MetricCard label="完成率" value={`${kpi.completionRate}%`} helper="已完成 / 總件數" />
      </section>

      <section className="boss-kpi-charts kpi-stat-grid">
        <StatBars title="工作類型統計" subtitle="Work Type" stats={kpi.workTypeStats} />
        <StatBars title="關聯項目統計" subtitle="System" stats={kpi.systemStats} />
        <StatBars title="服務範圍統計" subtitle="Impact" stats={kpi.departmentStats} />
        <StatBars title="狀態統計" subtitle="Status" stats={kpi.statusStats} />
      </section>

      <FollowList rows={kpi.followList} />
      <RecordsTable rows={kpi.records} />
      </div>
    </AppShell>
  );
}
