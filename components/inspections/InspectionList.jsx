"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InspectionStatusBadge from "./InspectionStatusBadge";
import QuickInspectionPanel from "./QuickInspectionPanel";
import {
  INSPECTION_TEMPLATE,
  OVERALL_STATUSES,
  calculateInspectionSummary,
  normalizeInspectionStatus
} from "./inspectionTemplates";

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const error = new Error(data.message || "資料讀取失敗");
    error.data = data.data;
    error.code = data.code;
    throw error;
  }
  return data.data;
}

function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "-";
}

function formatUpdatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getRecordSummary(record) {
  if (!record) {
    return {
      item_count: INSPECTION_TEMPLATE.length,
      normal_count: 0,
      abnormal_count: 0,
      observation_count: 0,
      overall_status: "未建立"
    };
  }

  if (Array.isArray(record.items) && record.items.length) {
    return calculateInspectionSummary(record.items);
  }

  return {
    item_count: record.item_count || 0,
    normal_count: record.normal_count || 0,
    abnormal_count: record.abnormal_count || 0,
    observation_count: record.observation_count || 0,
    overall_status: record.overall_status || "未檢查"
  };
}

export default function InspectionList() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawerState, setDrawerState] = useState(null);
  const [filters, setFilters] = useState({ date: "", inspector_name: "", overall_status: "", search: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/inspections");
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const today = todayTaipei();
  const todayRecord = useMemo(
    () => rows.find((row) => formatDate(row.inspection_date) === today),
    [rows, today]
  );
  const todaySummary = getRecordSummary(todayRecord);

  const inspectorOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.inspector_name).filter(Boolean))).sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.date && formatDate(row.inspection_date) !== filters.date) return false;
      if (filters.inspector_name && row.inspector_name !== filters.inspector_name) return false;
      if (filters.overall_status && normalizeInspectionStatus(row.overall_status) !== filters.overall_status) return false;
      if (!keyword) return true;
      const itemText = (row.items || []).map((item) => `${item.category} ${item.item_name} ${item.status}`).join(" ");
      return `${row.inspector_name || ""} ${row.overall_status || ""} ${itemText}`.toLowerCase().includes(keyword);
    });
  }, [rows, filters]);

  async function handleCreateToday() {
    setNotice("");
    setError("");
    try {
      const data = await api(`/api/inspections?date=${encodeURIComponent(today)}`);
      const existing = data.rows?.[0];
      if (existing) {
        setNotice(`今天已建立巡檢紀錄，已開啟 ${existing.inspector_name || "既有"} 的紀錄。`);
        setDrawerState({ mode: "edit", recordId: existing.id });
        return;
      }
      setDrawerState({ mode: "new", recordId: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  function clearFilters() {
    setFilters({ date: "", inspector_name: "", overall_status: "", search: "" });
  }

  async function handleSaved(record) {
    setDrawerState(null);
    setNotice(`已完成 ${formatDate(record.inspection_date)} 的每日巡檢。`);
    await load();
  }

  return (
    <section className="section-page inspection-page">
      <header className="inspection-page-head">
        <div>
          <h1>每日巡檢紀錄</h1>
          <p>檢視每日 IT 例行檢查、異常與處理進度</p>
        </div>
        <div className="section-actions">
          <button className="primary-action" onClick={handleCreateToday}>新增今日巡檢</button>
          <button onClick={load}>重新整理</button>
        </div>
      </header>

      <section className="inspection-overview" aria-label="今日巡檢概況">
        <div className="inspection-overview-card">
          <span>巡檢項目總數</span>
          <strong>{todaySummary.item_count}</strong>
        </div>
        <div className="inspection-overview-card ok">
          <span>正常</span>
          <strong>{todaySummary.normal_count}</strong>
        </div>
        <div className="inspection-overview-card danger">
          <span>異常</span>
          <strong>{todaySummary.abnormal_count}</strong>
        </div>
        <div className="inspection-overview-card warning">
          <span>待觀察</span>
          <strong>{todaySummary.observation_count}</strong>
        </div>
        <div className="inspection-overview-card status">
          <span>整體狀態</span>
          <InspectionStatusBadge value={todaySummary.overall_status} />
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="inspection-notice compact">{notice}</div> : null}

      <div className="inspection-toolbar">
        <label>
          日期
          <input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} />
        </label>
        <label>
          巡檢人員
          <select value={filters.inspector_name} onChange={(event) => setFilters((current) => ({ ...current, inspector_name: event.target.value }))}>
            <option value="">全部</option>
            {inspectorOptions.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label>
          狀態
          <select value={filters.overall_status} onChange={(event) => setFilters((current) => ({ ...current, overall_status: event.target.value }))}>
            <option value="">全部</option>
            {OVERALL_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="toolbar-search">
          搜尋
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="人員、項目或狀態" />
        </label>
        <button type="button" onClick={clearFilters}>清除篩選</button>
      </div>

      <div className="inspection-table">
        <div className="inspection-row head">
          <span>巡檢日期</span>
          <span>巡檢人員</span>
          <span>巡檢項目數</span>
          <span>正常</span>
          <span>異常</span>
          <span>待觀察</span>
          <span>整體狀態</span>
          <span>最後更新</span>
          <span>操作</span>
        </div>
        {loading ? (
          <div className="empty">讀取巡檢紀錄中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="inspection-empty-state">
            <h2>{filters.date || filters.inspector_name || filters.overall_status || filters.search ? "沒有符合條件的巡檢紀錄" : "今天尚未建立巡檢紀錄"}</h2>
            <p>點選建立今日巡檢，逐項確認後即可完成。</p>
            <button className="primary-action" onClick={handleCreateToday}>建立今日巡檢</button>
          </div>
        ) : (
          filteredRows.map((row) => {
            const summary = getRecordSummary(row);
            return (
              <div className={`inspection-row ${summary.abnormal_count > 0 ? "has-abnormal" : ""}`} key={row.id}>
                <span>{formatDate(row.inspection_date)}</span>
                <strong>{row.inspector_name || "-"}</strong>
                <span>{summary.item_count || 0}</span>
                <span>{summary.normal_count || 0}</span>
                <span>{summary.abnormal_count || 0}</span>
                <span>{summary.observation_count || 0}</span>
                <InspectionStatusBadge value={summary.overall_status} />
                <span>{formatUpdatedAt(row.updated_at)}</span>
                <span className="inspection-actions">
                  <button onClick={() => router.push(`/inspections/${row.id}`)}>查看</button>
                  <button onClick={() => setDrawerState({ mode: "edit", recordId: row.id })}>編輯</button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {drawerState ? (
        <div className="quick-drawer-shell" role="dialog" aria-modal="true" aria-label="快速巡檢">
          <button className="quick-drawer-backdrop" type="button" aria-label="關閉快速巡檢" onClick={() => setDrawerState(null)} />
          <aside className="quick-drawer">
            <QuickInspectionPanel
              mode={drawerState.mode}
              recordId={drawerState.recordId}
              drawer
              onCancel={() => setDrawerState(null)}
              onSaved={handleSaved}
            />
          </aside>
        </div>
      ) : null}
    </section>
  );
}
