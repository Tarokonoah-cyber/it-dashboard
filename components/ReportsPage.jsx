"use client";

import { useEffect, useMemo, useState } from "react";

const EMPTY_PREVIEW = { rows: [], totalRows: 0, summary: {}, options: {} };

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function monthRange(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric"
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value) - 1 + offset;
  const start = new Date(Date.UTC(year, month, 1, 12));
  const end = new Date(Date.UTC(year, month + 1, 0, 12));
  return { start: taipeiDate(start), end: offset === 0 ? taipeiDate() : taipeiDate(end) };
}

function SelectFilter({ label, value, onChange, options, allLabel = "全部" }) {
  return (
    <label className="report-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function MetricCard({ label, value, tone = "blue" }) {
  return (
    <article className={`report-metric tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function WorkPreview({ preview }) {
  const summary = preview.summary || {};
  return (
    <>
      <div className="report-metrics">
        <MetricCard label="工作總數" value={summary.total ?? 0} />
        <MetricCard label="已完成" value={summary.completed ?? 0} tone="green" />
        <MetricCard label="未完成" value={summary.open ?? 0} tone="amber" />
        <MetricCard label="完成率" value={`${summary.completionRate ?? 0}%`} tone="navy" />
      </div>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead><tr><th>日期</th><th>工作摘要</th><th>類型</th><th>系統</th><th>部門</th><th>狀態</th></tr></thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.id}><td>{row.workDate}</td><td>{row.summary}</td><td>{row.workType}</td><td>{row.system}</td><td>{row.department}</td><td><span className="report-status">{row.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InspectionPreview({ preview }) {
  const summary = preview.summary || {};
  return (
    <>
      <div className="report-metrics five">
        <MetricCard label="巡檢紀錄" value={summary.records ?? 0} />
        <MetricCard label="巡檢項目" value={summary.items ?? 0} tone="navy" />
        <MetricCard label="正常" value={summary.normal ?? 0} tone="green" />
        <MetricCard label="異常" value={summary.abnormal ?? 0} tone="red" />
        <MetricCard label="待觀察" value={summary.observation ?? 0} tone="amber" />
      </div>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead><tr><th>日期</th><th>巡檢人員</th><th>分類</th><th>項目</th><th>狀態</th><th>異常說明</th></tr></thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.id || `${row.inspectionRecordId}-${row.itemName}`}><td>{row.date}</td><td>{row.inspector}</td><td>{row.category}</td><td>{row.itemName}</td><td><span className="report-status">{row.status}</span></td><td>{row.issue || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ReportsPage() {
  const initialRange = useMemo(() => monthRange(0), []);
  const [filters, setFilters] = useState({ type: "work", ...initialRange, workType: "", system: "", department: "", status: "", inspector: "", period: "daily" });
  const [preview, setPreview] = useState(EMPTY_PREVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/reports/preview?${query}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "無法載入報表資料");
        setPreview(payload.data);
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setPreview(EMPTY_PREVIEW);
          setError(fetchError.message || "無法載入報表資料");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function switchType(type) {
    setFilters((current) => ({ ...current, type, status: "", workType: "", system: "", department: "", inspector: "" }));
  }

  function applyRange(offset) {
    setFilters((current) => ({ ...current, ...monthRange(offset) }));
  }

  async function download(format) {
    setDownloading(format);
    setError("");
    try {
      const response = await fetch(`/api/reports/export?${query}&format=${format}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "匯出失敗");
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const fallbackName = `${filters.type === "inspection" ? "巡檢" : "工作"}報表.${format}`;
      const filename = encodedName ? decodeURIComponent(encodedName) : fallbackName;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || "匯出失敗");
    } finally {
      setDownloading("");
    }
  }

  const options = preview.options || {};
  return (
    <section className="reports-page">
      <header className="reports-hero">
        <div><span className="reports-eyebrow">REPORTING CENTER</span><h2>營運報表中心</h2><p>依日期與條件彙整工作 KPI、每日與每月巡檢結果，並輸出正式 Excel 或 PDF。</p></div>
        <div className="report-downloads">
          <button type="button" className="report-download excel" onClick={() => download("xlsx")} disabled={Boolean(downloading) || loading}>{downloading === "xlsx" ? "產生中…" : "匯出 Excel"}</button>
          <button type="button" className="report-download pdf" onClick={() => download("pdf")} disabled={Boolean(downloading) || loading}>{downloading === "pdf" ? "產生中…" : "匯出 PDF"}</button>
        </div>
      </header>

      <div className="report-tabs" role="tablist" aria-label="報表類型">
        <button type="button" role="tab" aria-selected={filters.type === "work"} className={filters.type === "work" ? "active" : ""} onClick={() => switchType("work")}>工作 KPI</button>
        <button type="button" role="tab" aria-selected={filters.type === "inspection"} className={filters.type === "inspection" ? "active" : ""} onClick={() => switchType("inspection")}>巡檢報表</button>
      </div>

      <div className="report-controls">
        <div className="report-presets"><span>快速日期</span><button type="button" onClick={() => applyRange(0)}>本月</button><button type="button" onClick={() => applyRange(-1)}>上月</button></div>
        <div className="report-filter-grid">
          <label className="report-filter"><span>開始日期</span><input type="date" value={filters.start} onChange={(event) => update("start", event.target.value)} /></label>
          <label className="report-filter"><span>結束日期</span><input type="date" value={filters.end} onChange={(event) => update("end", event.target.value)} /></label>
          {filters.type === "work" ? (
            <>
              <SelectFilter label="工作類型" value={filters.workType} onChange={(value) => update("workType", value)} options={options.workTypes || []} />
              <SelectFilter label="系統" value={filters.system} onChange={(value) => update("system", value)} options={options.systems || []} />
              <SelectFilter label="部門" value={filters.department} onChange={(value) => update("department", value)} options={options.departments || []} />
              <SelectFilter label="狀態" value={filters.status} onChange={(value) => update("status", value)} options={options.statuses || []} />
            </>
          ) : (
            <>
              <label className="report-filter"><span>巡檢週期</span><select value={filters.period} onChange={(event) => update("period", event.target.value)}><option value="daily">每日</option><option value="monthly">每月</option><option value="all">全部</option></select></label>
              <SelectFilter label="巡檢人員" value={filters.inspector} onChange={(value) => update("inspector", value)} options={options.inspectors || []} />
              <SelectFilter label="整體狀態" value={filters.status} onChange={(value) => update("status", value)} options={options.statuses || []} />
            </>
          )}
        </div>
      </div>

      {error && <div className="report-error" role="alert">{error}</div>}
      <section className={`report-preview ${loading ? "is-loading" : ""}`} aria-busy={loading}>
        <div className="report-preview-head"><div><span>即時預覽</span><h3>{filters.type === "work" ? "工作 KPI 明細" : "巡檢結果明細"}</h3></div><small>{loading ? "資料整理中…" : `共 ${preview.totalRows || 0} 筆，畫面顯示前 50 筆`}</small></div>
        {!loading && preview.totalRows === 0 ? <div className="report-empty">目前條件沒有可顯示的資料，請調整日期或篩選條件。</div> : filters.type === "work" ? <WorkPreview preview={preview} /> : <InspectionPreview preview={preview} />}
      </section>
    </section>
  );
}
