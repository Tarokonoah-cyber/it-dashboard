"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InspectionStatusBadge from "./InspectionStatusBadge";
import { OVERALL_STATUSES } from "./inspectionTemplates";

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

export default function InspectionList() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ date: "", inspector_name: "", overall_status: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await api(`/api/inspections${suffix}`);
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters.date, filters.inspector_name, filters.overall_status]);

  const inspectorOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.inspector_name).filter(Boolean))).sort(),
    [rows]
  );

  async function handleCreateToday() {
    setNotice("");
    try {
      const today = todayTaipei();
      const data = await api(`/api/inspections?date=${encodeURIComponent(today)}`);
      const existing = data.rows?.[0];
      if (existing) {
        setNotice(`今天已建立巡檢紀錄，請編輯 ${existing.inspector_name || "既有"} 的紀錄。`);
        router.push(`/inspections/${existing.id}/edit`);
        return;
      }
      router.push("/inspections/new");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="section-page inspection-page">
      <header className="section-head">
        <div>
          <p>檢視每日 IT 例行檢查、異常與處理進度</p>
        </div>
        <div className="section-actions">
          <button onClick={load}>重新整理</button>
          <button className="primary-action" onClick={handleCreateToday}>新增今日巡檢紀錄</button>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="inspection-notice">{notice}</div> : null}

      <div className="inspection-filters">
        <label>
          巡檢日期
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
          整體狀態
          <select value={filters.overall_status} onChange={(event) => setFilters((current) => ({ ...current, overall_status: event.target.value }))}>
            <option value="">全部</option>
            {OVERALL_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>

      <div className="inspection-table">
        <div className="inspection-row head">
          <span>巡檢日期</span>
          <span>巡檢人員</span>
          <span>巡檢項目數</span>
          <span>正常數</span>
          <span>異常數</span>
          <span>需觀察數</span>
          <span>整體狀態</span>
          <span>最後更新時間</span>
          <span>操作</span>
        </div>
        {loading ? (
          <div className="empty">讀取巡檢紀錄中...</div>
        ) : rows.length === 0 ? (
          <div className="empty">目前沒有符合條件的巡檢紀錄</div>
        ) : (
          rows.map((row) => (
            <div className={`inspection-row ${row.abnormal_count > 0 ? "has-abnormal" : ""}`} key={row.id}>
              <span>{formatDate(row.inspection_date)}</span>
              <strong>{row.inspector_name || "-"}</strong>
              <span>{row.item_count || 0}</span>
              <span>{row.normal_count || 0}</span>
              <span>{row.abnormal_count || 0}</span>
              <span>{row.observation_count || 0}</span>
              <InspectionStatusBadge value={row.overall_status} />
              <span>{formatUpdatedAt(row.updated_at)}</span>
              <span className="inspection-actions">
                <button onClick={() => router.push(`/inspections/${row.id}`)}>查看</button>
                <button onClick={() => router.push(`/inspections/${row.id}/edit`)}>編輯</button>
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
