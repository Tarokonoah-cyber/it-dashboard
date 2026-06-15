"use client";

import { useEffect, useMemo, useState } from "react";

const WORK_CATEGORIES = ["一般", "設備維護", "系統更新", "網路", "SOP", "設備", "合約", "系統", "其他"];
const WORK_STATUSES = ["待處理", "進行中", "已完成", "暫緩", "異常"];
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

function normalizeStatus(status) {
  const text = String(status || "").trim();
  if (!text) return "待處理";
  if (DONE_STATUSES.has(text) || text.includes("完成")) return "已完成";
  if (text.includes("進") || text.toLowerCase() === "doing") return "進行中";
  if (text.includes("異常") || text.includes("逾期") || text.toLowerCase() === "error") return "異常";
  if (text.includes("暫") || text.includes("等")) return "暫緩";
  return text;
}

function statusClassName(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "已完成") return "status-done";
  if (normalized === "進行中") return "status-active";
  if (normalized === "異常") return "status-danger";
  return "status-pending";
}

function isDoneStatus(status) {
  return normalizeStatus(status) === "已完成";
}

export default function WorkCenterPage() {
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
      const created = await api("/api/work-logs", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm((current) => ({ ...current, title: "", note: "" }));
      setFilters({ date: "", staff: "", status: "", category: "" });
      setWorks((current) => [created, ...current.filter((work) => work.id !== created.id)]);
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
          <h1>工作中心</h1>
          <p>新增、篩選與追蹤日常工作紀錄。</p>
        </div>
        <div className="work-head-actions">
          <button className="boss-kpi-entry" onClick={() => { window.location.href = "/boss-kpi"; }}>查看 KPI 報表</button>
          <button onClick={load}>重新整理</button>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}

      <form className="work-entry-panel" onSubmit={submitWork}>
        <header>
          <div>
            <h2>新增工作</h2>
            <span>建立一筆可追蹤的工作紀錄，並同步進入工作列表。</span>
          </div>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? "新增中..." : "新增工作"}
          </button>
        </header>
        <div className="work-entry-grid">
          <label>
            日期
            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
          </label>
          <label>
            負責人
            <input value={form.staff} onChange={(event) => setForm((current) => ({ ...current, staff: event.target.value }))} placeholder="Noah / Urza" required />
          </label>
          <label className="wide">
            工作內容
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：客房樓層設備檢查" required />
          </label>
          <label>
            類型
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {WORK_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            狀態
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {WORK_STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="wide">
            備註
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="補充處理細節、廠商回覆或後續追蹤事項" />
          </label>
        </div>
      </form>

      <section className="work-records-panel">
        <header className="work-records-head">
          <div>
            <h2>工作紀錄</h2>
            <span>{loading ? "讀取中..." : `${works.length} 筆`}</span>
          </div>
          <button onClick={clearFilters}>清除篩選</button>
        </header>
        <div className="work-filters">
          <label>
            日期
            <input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>
            狀態
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">全部</option>
              {options.status.map((item) => <option key={item} value={item}>{normalizeStatus(item)}</option>)}
            </select>
          </label>
          <label>
            負責人
            <select value={filters.staff} onChange={(event) => setFilters((current) => ({ ...current, staff: event.target.value }))}>
              <option value="">全部</option>
              {options.staff.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            類型
            <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">全部</option>
              {options.category.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="full-work-table">
          <div className="full-work-row head">
            <span>日期</span>
            <span>負責人</span>
            <span>工作內容</span>
            <span>類型</span>
            <span>狀態</span>
            <span>備註</span>
          </div>
          {loading ? (
            <div className="empty">讀取工作紀錄中...</div>
          ) : works.length === 0 ? (
            <div className="empty">目前沒有符合條件的工作紀錄</div>
          ) : (
            works.map((work) => (
              <div className="full-work-row" key={work.id}>
                <span>{formatDate(work.date || work.created_at)}</span>
                <span>{work.staff || "-"}</span>
                <strong title={work.title || ""}>{work.title || "未命名工作"}</strong>
                <span>{work.category || "一般"}</span>
                <b className={isDoneStatus(work.status) ? "status-done" : statusClassName(work.status)}>{normalizeStatus(work.status)}</b>
                <span title={work.note || ""}>{work.note || "-"}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
