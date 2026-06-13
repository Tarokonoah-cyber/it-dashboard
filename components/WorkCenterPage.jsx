"use client";

import { useEffect, useMemo, useState } from "react";

const WORK_CATEGORIES = ["一般", "維修", "行政支援", "採購", "SOP", "設備", "網路", "系統", "其他"];
const WORK_STATUSES = ["已完成", "處理中", "待處理", "未開始", "異常"];
const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "資料讀取失敗");
  return data.data;
}

function dateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDate(value) {
  return dateKey(value) || "-";
}

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || "").trim());
}

export default function WorkCenterPage() {
  const L = {
    pageTitle: "工作中心",
    pageDesc: "新增、查詢、管理所有工作紀錄。這裡不放儀表板統計卡。",
    refresh: "刷新",
    addTitle: "＋新增工作紀錄",
    addDesc: "適合記錄臨時完成、沒有在 Todo List 裡的工作",
    saving: "新增中...",
    date: "日期",
    staff: "人員",
    title: "工作標題",
    titlePlaceholder: "例如：協助櫃台處理讀卡機",
    category: "類型",
    status: "狀態",
    note: "備註",
    notePlaceholder: "補充處理內容、廠商、房號或後續事項",
    recordsTitle: "全部工作紀錄",
    loading: "讀取中...",
    loadingRecords: "讀取工作紀錄中...",
    countUnit: "筆",
    clear: "清除篩選",
    all: "全部",
    empty: "目前沒有符合條件的工作紀錄",
    untitled: "未命名工作",
    general: "一般",
    notStarted: "未開始"
  };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ date: "", staff: "", status: "", category: "" });
  const [form, setForm] = useState({
    date: today,
    staff: "Noah",
    title: "",
    category: WORK_CATEGORIES[0],
    status: WORK_STATUSES[0],
    note: ""
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await api(`/api/work-logs${suffix}`);
      setWorks(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters.date, filters.staff, filters.status, filters.category]);

  const options = useMemo(() => {
    const unique = (key) => Array.from(new Set(works.map((work) => String(work[key] || "").trim()).filter(Boolean)));
    return {
      staff: unique("staff"),
      status: unique("status"),
      category: unique("category")
    };
  }, [works]);

  async function submitWork(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/work-logs", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm((current) => ({ ...current, title: "", note: "" }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setFilters({ date: "", staff: "", status: "", category: "" });
  }

  return (
    <section className="section-page work-management-page">
      <header className="section-head">
        <div>
          <h1>{L.pageTitle}</h1>
          <p>{L.pageDesc}</p>
        </div>
        <div className="work-head-actions">
          <button className="boss-kpi-entry" onClick={() => { window.location.href = "/boss-kpi"; }}>老闆 KPI 月報</button>
          <button onClick={load}>{L.refresh}</button>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}

      <form className="work-entry-panel" onSubmit={submitWork}>
        <header>
          <div>
            <h2>{L.addTitle}</h2>
            <span>{L.addDesc}</span>
          </div>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? L.saving : L.addTitle}
          </button>
        </header>
        <div className="work-entry-grid">
          <label>
            {L.date}
            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
          </label>
          <label>
            {L.staff}
            <input value={form.staff} onChange={(event) => setForm((current) => ({ ...current, staff: event.target.value }))} placeholder="Noah / Urza" required />
          </label>
          <label className="wide">
            {L.title}
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={L.titlePlaceholder} required />
          </label>
          <label>
            {L.category}
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {WORK_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            {L.status}
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {WORK_STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="wide">
            {L.note}
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder={L.notePlaceholder} />
          </label>
        </div>
      </form>

      <section className="work-records-panel">
        <header className="work-records-head">
          <div>
            <h2>{L.recordsTitle}</h2>
            <span>{loading ? L.loading : `${works.length} ${L.countUnit}`}</span>
          </div>
          <button onClick={clearFilters}>{L.clear}</button>
        </header>
        <div className="work-filters">
          <label>
            {L.date}
            <input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>
            {L.status}
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">{L.all}</option>
              {options.status.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            {L.staff}
            <select value={filters.staff} onChange={(event) => setFilters((current) => ({ ...current, staff: event.target.value }))}>
              <option value="">{L.all}</option>
              {options.staff.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            {L.category}
            <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">{L.all}</option>
              {options.category.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="full-work-table">
          <div className="full-work-row head">
            <span>{L.date}</span>
            <span>{L.staff}</span>
            <span>{L.title}</span>
            <span>{L.category}</span>
            <span>{L.status}</span>
            <span>{L.note}</span>
          </div>
          {loading ? (
            <div className="empty">{L.loadingRecords}</div>
          ) : works.length === 0 ? (
            <div className="empty">{L.empty}</div>
          ) : (
            works.map((work) => (
              <div className="full-work-row" key={work.id}>
                <span>{formatDate(work.date || work.created_at)}</span>
                <span>{work.staff || "-"}</span>
                <strong>{work.title || L.untitled}</strong>
                <span>{work.category || L.general}</span>
                <b className={isDoneStatus(work.status) ? "status-done" : "status-pending"}>{work.status || L.notStarted}</b>
                <span>{work.note || "-"}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
