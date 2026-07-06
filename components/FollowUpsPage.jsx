"use client";

import { useEffect, useMemo, useState } from "react";

const FOLLOW_UP_STATUSES = ["等待回覆", "處理中", "待確認", "已完成"];

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

function todayKey() {
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

function emptyForm() {
  return {
    title: "",
    current_status: "等待回覆",
    next_follow_date: todayKey(),
    note: ""
  };
}

export default function FollowUpsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isEditing = Boolean(editingId);

  const openItems = useMemo(() => items.filter((item) => item.current_status !== "已完成"), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.current_status === "已完成"), [items]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await api("/api/follow-ups?includeCompleted=1"));
    } catch (err) {
      setError(err.message || "待追蹤讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId("");
    setForm(emptyForm());
    setIsFormOpen(false);
  }

  function editItem(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      current_status: item.current_status || "等待回覆",
      next_follow_date: formatDate(item.next_follow_date) === "-" ? todayKey() : formatDate(item.next_follow_date),
      note: item.note || ""
    });
    setIsFormOpen(true);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("請輸入追蹤事項");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await api("/api/follow-ups", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(isEditing ? { id: editingId, ...form, title } : { ...form, title })
      });
      const nextItem = saved.followUp || saved;
      setItems((current) => [nextItem, ...current.filter((item) => item.id !== nextItem.id)]);
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || "待追蹤儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(item, payload) {
    if (!item?.id) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api("/api/follow-ups", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, ...payload })
      });
      setItems((current) => current.map((currentItem) => (currentItem.id === saved.id ? saved : currentItem)));
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      setError(err.message || "待追蹤更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item) {
    if (!item?.id) return;
    if (!window.confirm(`確定刪除「${item.title || "未命名追蹤事項"}」？`)) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/follow-ups?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      if (editingId === item.id) resetForm();
    } catch (err) {
      setError(err.message || "待追蹤刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  async function rescheduleItem(item) {
    const nextDate = window.prompt("重新安排追蹤日", formatDate(item.next_follow_date) === "-" ? todayKey() : formatDate(item.next_follow_date));
    if (nextDate === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate.trim())) {
      setError("請輸入 YYYY-MM-DD 格式的日期");
      return;
    }
    await updateItem(item, {
      next_follow_date: nextDate.trim(),
      current_status: item.current_status === "已完成" ? "待確認" : item.current_status
    });
  }

  function renderItem(item) {
    return (
      <article className={`follow-up-list-row ${item.current_status === "已完成" ? "is-done" : ""}`} key={item.id}>
        <div>
          <strong>{item.title || "未命名追蹤事項"}</strong>
          {item.note ? <p>{item.note}</p> : null}
        </div>
        <span>{item.current_status || "等待回覆"}</span>
        <time>{formatDate(item.next_follow_date)}</time>
        <div className="follow-up-row-actions">
          <button type="button" onClick={() => editItem(item)} disabled={saving}>編輯</button>
          <button type="button" onClick={() => updateItem(item, { current_status: "已完成" })} disabled={saving || item.current_status === "已完成"}>完成</button>
          <button type="button" onClick={() => rescheduleItem(item)} disabled={saving}>重排</button>
          <button className="danger" type="button" onClick={() => deleteItem(item)} disabled={saving}>刪除</button>
        </div>
      </article>
    );
  }

  return (
    <section className="section-page follow-ups-page">
      <header className="section-head">
        <div>
          <h1>待追蹤</h1>
        </div>
        <button type="button" onClick={load} disabled={loading}>{loading ? "讀取中" : "重新整理"}</button>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      {!isFormOpen ? (
        <button className="follow-up-add-toggle" type="button" onClick={() => setIsFormOpen(true)}>
          新增待追蹤
        </button>
      ) : null}

      {isFormOpen ? (
      <form className="follow-up-entry-panel" onSubmit={submit}>
        <header>
          <h2>{isEditing ? "編輯待追蹤" : "新增待追蹤"}</h2>
        </header>
        <div className="follow-up-entry-grid">
          <label className="wide">
            追蹤事項
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <label>
            目前狀況
            <select value={form.current_status} onChange={(event) => setForm((current) => ({ ...current, current_status: event.target.value }))}>
              {FOLLOW_UP_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            下次追蹤日
            <input type="date" value={form.next_follow_date} onChange={(event) => setForm((current) => ({ ...current, next_follow_date: event.target.value }))} required />
          </label>
          <label className="wide">
            備註
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} />
          </label>
          <div className="follow-up-form-actions">
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "儲存中" : isEditing ? "儲存修改" : "新增"}</button>
            {isEditing ? <button type="button" onClick={resetForm} disabled={saving}>取消</button> : null}
          </div>
        </div>
      </form>
      ) : null}

      <section className="follow-up-list-panel">
        <header>
          <h2>清單</h2>
          <span>{loading ? "讀取中..." : `${openItems.length} 筆未完成`}</span>
        </header>
        <div className="follow-up-list">
          {openItems.length ? openItems.map(renderItem) : <div className="empty">目前沒有待追蹤項目</div>}
        </div>
      </section>

      {completedItems.length ? (
        <section className="follow-up-list-panel compact">
          <header>
            <h2>已完成</h2>
            <span>{completedItems.length} 筆</span>
          </header>
          <div className="follow-up-list">
            {completedItems.map(renderItem)}
          </div>
        </section>
      ) : null}
    </section>
  );
}
