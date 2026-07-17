"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ISO_WEEKDAYS, formatRecurrence } from "../lib/recurringTasks";

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "每天" },
  { value: "weekdays", label: "每週一至週五" },
  { value: "weekly", label: "每週指定星期" },
  { value: "monthly", label: "每月指定日期" }
];

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function emptyForm() {
  return {
    title: "",
    note: "",
    priority: "一般",
    owner: "共同",
    recurrence_kind: "weekdays",
    weekday: 1,
    day_of_month: 1,
    start_date: todayKey(),
    end_date: "",
    is_active: true
  };
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "週期任務資料讀取失敗");
  return payload.data;
}

function dateLabel(value) {
  return value ? String(value).slice(0, 10) : "未設定";
}

export default function RecurringTasksPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await api("/api/recurring-tasks"));
    } catch (loadError) {
      setError(loadError.message || "週期任務資料讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.is_active).length,
    paused: items.filter((item) => !item.is_active).length,
    important: items.filter((item) => item.priority === "重要" && item.is_active).length
  }), [items]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function openCreate() {
    setEditingId("");
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      note: item.note || "",
      priority: item.priority || "一般",
      owner: item.owner || "共同",
      recurrence_kind: item.recurrence_kind || "daily",
      weekday: Number(item.weekday || 1),
      day_of_month: Number(item.day_of_month || 1),
      start_date: item.start_date || todayKey(),
      end_date: item.end_date || "",
      is_active: item.is_active !== false
    });
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    setEditingId("");
    setForm(emptyForm());
    setFormOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await api("/api/recurring-tasks", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form)
      });
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      closeForm();
      await load();
    } catch (saveError) {
      setError(saveError.message || "週期任務儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setProcessingId(item.id);
    setError("");
    try {
      const saved = await api("/api/recurring-tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, is_active: !item.is_active })
      });
      setItems((current) => current.map((row) => row.id === saved.id ? saved : row));
    } catch (toggleError) {
      setError(toggleError.message || "週期任務狀態更新失敗");
    } finally {
      setProcessingId("");
    }
  }

  async function archive(item) {
    if (!window.confirm(`封存「${item.title}」？已產生的工作紀錄會保留。`)) return;
    setProcessingId(item.id);
    setError("");
    try {
      await api(`/api/recurring-tasks?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setItems((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) closeForm();
    } catch (archiveError) {
      setError(archiveError.message || "週期任務封存失敗");
    } finally {
      setProcessingId("");
    }
  }

  return (
    <section className="section-page recurring-tasks-page">
      <header className="recurring-page-head">
        <div>
          <h1>週期任務</h1>
          <p>設定一次，系統每天自動把該做的工作加入未完成任務。</p>
        </div>
        <button className="recurring-primary-button" type="button" onClick={formOpen ? closeForm : openCreate}>
          {formOpen ? "收合" : "新增週期任務"}
        </button>
      </header>

      <div className="recurring-summary-grid" aria-label="週期任務摘要">
        <article><span>全部範本</span><strong>{summary.total}</strong></article>
        <article><span>執行中</span><strong>{summary.active}</strong></article>
        <article><span>已暫停</span><strong>{summary.paused}</strong></article>
        <article className="important"><span>重要任務</span><strong>{summary.important}</strong></article>
      </div>

      {error ? <div className="error-box" role="alert">{error}</div> : null}

      {formOpen ? (
        <form className="recurring-editor" onSubmit={submit}>
          <header>
            <div><span>自動建立未完成工作</span><h2>{editingId ? "編輯週期任務" : "新增週期任務"}</h2></div>
            <button type="button" onClick={closeForm} disabled={saving} aria-label="關閉表單">×</button>
          </header>
          <div className="recurring-form-grid">
            <label className="wide">
              工作名稱
              <input value={form.title} maxLength={120} onChange={(event) => updateForm("title", event.target.value)} required autoFocus />
            </label>
            <label>
              優先級
              <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value)}>
                <option>一般</option>
                <option>重要</option>
              </select>
            </label>
            <label>
              負責人
              <input value={form.owner} maxLength={120} onChange={(event) => updateForm("owner", event.target.value)} required />
            </label>
            <label>
              週期
              <select value={form.recurrence_kind} onChange={(event) => updateForm("recurrence_kind", event.target.value)}>
                {RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {form.recurrence_kind === "weekly" ? (
              <label>
                每週執行日
                <select value={form.weekday} onChange={(event) => updateForm("weekday", Number(event.target.value))}>
                  {ISO_WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                </select>
              </label>
            ) : null}
            {form.recurrence_kind === "monthly" ? (
              <label>
                每月日期
                <input type="number" min="1" max="31" value={form.day_of_month} onChange={(event) => updateForm("day_of_month", Number(event.target.value))} required />
              </label>
            ) : null}
            <label>
              開始日期
              <input type="date" value={form.start_date} onChange={(event) => updateForm("start_date", event.target.value)} required />
            </label>
            <label>
              結束日期（選填）
              <input type="date" min={form.start_date} value={form.end_date} onChange={(event) => updateForm("end_date", event.target.value)} />
            </label>
            <label className="wide">
              備註
              <textarea value={form.note} maxLength={1000} rows={3} onChange={(event) => updateForm("note", event.target.value)} />
            </label>
            <label className="recurring-active-toggle">
              <input type="checkbox" checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} />
              儲存後立即啟用
            </label>
            <div className="recurring-form-actions">
              <button className="primary-action" type="submit" disabled={saving}>{saving ? "儲存中" : editingId ? "儲存修改" : "建立範本"}</button>
              <button type="button" onClick={closeForm} disabled={saving}>取消</button>
            </div>
          </div>
        </form>
      ) : null}

      <section className="recurring-list-panel">
        <header><div><h2>任務範本</h2><span>每天 08:30 自動檢查</span></div><button type="button" onClick={load} disabled={loading}>重新整理</button></header>
        <div className="recurring-list">
          {loading ? <div className="empty">讀取週期任務中…</div> : null}
          {!loading && !items.length ? <div className="empty">尚未建立週期任務</div> : null}
          {!loading ? items.map((item) => (
            <article className={`recurring-row ${item.is_active ? "is-active" : "is-paused"} ${item.priority === "重要" ? "is-important" : ""}`} key={item.id}>
              <span className="recurring-row-rail" aria-hidden="true" />
              <div className="recurring-row-main">
                <div><strong>{item.title}</strong><span className={`recurring-priority ${item.priority === "重要" ? "important" : ""}`}>{item.priority}</span></div>
                {item.note ? <p>{item.note}</p> : null}
                <small>{formatRecurrence(item)} · {item.owner} · {dateLabel(item.start_date)} 起{item.end_date ? `至 ${dateLabel(item.end_date)}` : ""}</small>
              </div>
              <div className="recurring-row-state">
                <b>{item.is_active ? "執行中" : "已暫停"}</b>
                <small>檢查至 {dateLabel(item.last_checked_date)}</small>
              </div>
              <div className="recurring-row-actions">
                <button type="button" onClick={() => toggleActive(item)} disabled={processingId === item.id}>{item.is_active ? "暫停" : "啟用"}</button>
                <button type="button" onClick={() => openEdit(item)} disabled={processingId === item.id}>編輯</button>
                <button className="danger" type="button" onClick={() => archive(item)} disabled={processingId === item.id}>封存</button>
              </div>
            </article>
          )) : null}
        </div>
      </section>
    </section>
  );
}
