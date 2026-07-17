"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WorkCompletionDialog from "./WorkCompletionDialog";
import { loadRelatedFollowUps, settleWorkFollowUps } from "../lib/work-completion-client";
import { getTomorrowDate } from "../lib/work-follow-up";

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

function getInitialQueryParam(key) {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get(key) || "").trim();
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
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [completionContext, setCompletionContext] = useState(null);
  const [completionRelated, setCompletionRelated] = useState([]);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionSaving, setCompletionSaving] = useState(false);
  const [filters, setFilters] = useState(() => ({
    date: "",
    status: "",
    category: ""
  }));
  const [searchText, setSearchText] = useState(() => getInitialQueryParam("q"));
  const [form, setForm] = useState({
    date: today,
    title: "",
    category: WORK_CATEGORIES[0],
    status: WORK_STATUSES[0],
    note: ""
  });
  const hasFilters = Boolean(filters.date || filters.status || filters.category || searchText.trim());
  const isEditing = Boolean(editingId);

  useEffect(() => {
    const query = getInitialQueryParam("q");
    if (query) setSearchText(query);
  }, []);

  const load = useCallback(async function load() {
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
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const options = useMemo(() => {
    const unique = (key) => Array.from(new Set(works.map((work) => String(work[key] || "").trim()).filter(Boolean)));
    return {
      status: unique("status"),
      category: unique("category")
    };
  }, [works]);

  async function submitWork(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("工作內容不可空白");
      return;
    }
    if (/^\d+$/.test(title)) {
      setError("工作內容不可只輸入數字，請補上可辨識的工作說明");
      return;
    }
    const payload = { ...form, title };
    const editingWork = isEditing ? works.find((work) => work.id === editingId) : null;
    if (editingWork && !isDoneStatus(editingWork.status) && isDoneStatus(payload.status)) {
      const work = { ...editingWork, ...payload };
      setCompletionContext({ work, payload });
      setCompletionRelated([]);
      setCompletionLoading(true);
      setError("");
      try {
        setCompletionRelated(await loadRelatedFollowUps(work));
      } catch (err) {
        setError(`無法檢查相關待追蹤：${err.message}`);
      } finally {
        setCompletionLoading(false);
      }
      return;
    }

    setSaving(true);
    setError("");
    try {
      const saved = await api("/api/work-logs", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(isEditing ? { id: editingId, ...payload } : payload)
      });
      finishSavedWork(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function finishSavedWork(saved) {
    resetForm();
    setFilters({ date: "", status: "", category: "" });
    setSearchText("");
    setWorks((current) => [saved, ...current.filter((work) => work.id !== saved.id)]);
    window.dispatchEvent(new CustomEvent("dashboard-data-changed", { detail: { type: "work-updated", id: saved.id } }));
  }

  async function confirmCompletion(choice) {
    if (!completionContext?.work?.id || completionSaving) return;
    setCompletionSaving(true);
    setSaving(true);
    setError("");
    let saved = null;
    try {
      saved = await api("/api/work-logs", {
        method: "PATCH",
        body: JSON.stringify({ id: completionContext.work.id, ...completionContext.payload, status: "已完成" })
      });
      finishSavedWork(saved);
      await settleWorkFollowUps({
        work: saved,
        related: completionRelated,
        ...choice
      });
    } catch (err) {
      setError(saved ? `工作已完成，但待追蹤處理失敗：${err.message}` : err.message);
    } finally {
      setCompletionContext(null);
      setCompletionRelated([]);
      setCompletionSaving(false);
      setSaving(false);
    }
  }

  function resetForm() {
    setEditingId("");
    setShowNote(false);
    setForm({
      date: today,
      title: "",
      category: WORK_CATEGORIES[0],
      status: WORK_STATUSES[0],
      note: ""
    });
  }

  function editWork(work) {
    setEditingId(work.id);
    setShowNote(Boolean(work.note));
    setForm({
      date: dateKey(work.date || work.created_at) || today,
      title: work.title || "",
      category: work.category || WORK_CATEGORIES[0],
      status: normalizeStatus(work.status),
      note: work.note || ""
    });
    setError("");
  }

  async function deleteWork(work) {
    if (!work?.id) return;
    if (!window.confirm("確定要刪除這筆工作紀錄嗎？此操作無法復原。")) return;
    setDeletingId(work.id);
    setError("");
    try {
      await api(`/api/work-logs?id=${encodeURIComponent(work.id)}`, { method: "DELETE" });
      setWorks((current) => current.filter((item) => item.id !== work.id));
      if (editingId === work.id) resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
    }
  }

  function clearFilters() {
    setFilters({ date: "", status: "", category: "" });
    setSearchText("");
  }

  const visibleWorks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return works;
    return works.filter((work) => [
      work.title,
      work.description,
      work.note,
      work.category,
      work.status,
      work.staff,
      work.source_id,
      formatDate(work.date || work.created_at)
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [searchText, works]);

  return (
    <section className="section-page work-management-page">
      <header className="section-head">
        <div>
          <h1>工作中心</h1>
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
            <h2>{isEditing ? "編輯工作" : "新增工作"}</h2>
          </div>
        </header>
        <div className="work-entry-grid">
          <label>
            日期
            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
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
          <div className="work-form-actions">
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? (isEditing ? "更新中..." : "新增中...") : (isEditing ? "更新工作" : "新增工作")}
            </button>
            {isEditing ? <button type="button" onClick={resetForm}>取消</button> : null}
          </div>
          <div className="work-note-toggle">
            <button type="button" onClick={() => setShowNote((current) => !current)}>
              {showNote ? "收合備註" : "加入備註"}
            </button>
          </div>
          {showNote ? (
            <label className="wide note-field">
              備註
              <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="補充處理細節、廠商回覆或後續追蹤事項" />
            </label>
          ) : null}
        </div>
      </form>

      <section className="work-records-panel">
        <header className="work-records-head">
          <div>
            <h2>工作紀錄</h2>
            <span>{loading ? "讀取中..." : `${visibleWorks.length} / ${works.length} 筆`}</span>
          </div>
        </header>
        <div className="work-filters">
          <label className="work-search-field">
            搜尋
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="輸入工作內容、備註或日期"
            />
          </label>
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
            類型
            <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">全部</option>
              {options.category.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {hasFilters ? <button className="work-clear-filters" onClick={clearFilters} type="button">清除篩選</button> : null}
        </div>
        <div className="full-work-table">
          <div className="full-work-row head">
            <span>日期</span>
            <span>工作內容</span>
            <span>類型</span>
            <span>狀態</span>
            <span>備註</span>
            <span>操作</span>
          </div>
          {loading ? (
            <div className="empty">讀取工作紀錄中...</div>
          ) : visibleWorks.length === 0 ? (
            <div className="empty">目前沒有符合條件的工作紀錄</div>
          ) : (
            visibleWorks.map((work) => (
              <div className="full-work-row" key={work.id}>
                <span>{formatDate(work.date || work.created_at)}</span>
                <strong title={work.title || ""}>{work.title || "未命名工作"}</strong>
                <span>{work.category || "一般"}</span>
                <b className={isDoneStatus(work.status) ? "status-done" : statusClassName(work.status)}>{normalizeStatus(work.status)}</b>
                <span title={work.note || ""}>{work.note || "-"}</span>
                <span className="work-row-actions">
                  <button type="button" onClick={() => editWork(work)}>編輯</button>
                  <button className="danger" disabled={deletingId === work.id} type="button" onClick={() => deleteWork(work)}>
                    {deletingId === work.id ? "刪除中" : "刪除"}
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <WorkCompletionDialog
        work={completionContext?.work}
        related={completionRelated}
        defaultDate={getTomorrowDate(today)}
        loading={completionLoading}
        saving={completionSaving}
        onCancel={() => { if (!completionSaving) setCompletionContext(null); }}
        onConfirm={confirmCompletion}
      />
    </section>
  );
}
