"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/dashboard-api";
import { formatDate, formatRelativeDate, getTodayKey } from "../../lib/dashboard-formatters";

const MAX_WORK_TITLE_LENGTH = 200;
const WORK_ORDER_STORAGE_KEY = "dashboard-work-order-v1";
const WORK_CATEGORIES = ["一般", "設備維護", "系統更新", "網路", "SOP", "設備", "合約", "系統", "其他"];

function mergeWorkOrder(savedOrder, rows) {
  const ids = (rows || []).map((row) => String(row.id || "")).filter(Boolean);
  const idSet = new Set(ids);
  const kept = (Array.isArray(savedOrder) ? savedOrder : []).map(String).filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  return [...ids.filter((id) => !keptSet.has(id)), ...kept];
}

function orderWorks(rows, order) {
  const orderMap = new Map((order || []).map((id, index) => [String(id), index]));
  return [...(rows || [])].sort((left, right) => {
    const leftOrder = orderMap.get(String(left.id));
    const rightOrder = orderMap.get(String(right.id));
    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return 0;
  });
}

function replaceOpenWorks(dashboard, nextOpenWorks, options = {}) {
  if (!dashboard) return dashboard;
  const completedDelta = Number(options.completedDelta || 0);
  const createdDelta = Number(options.createdDelta || 0);
  return {
    ...dashboard,
    openWorks: nextOpenWorks,
    pendingCount: nextOpenWorks.length,
    completedCount: Math.max(0, Number(dashboard.completedCount || 0) + completedDelta),
    todayWorkCount: Math.max(0, Number(dashboard.todayWorkCount || 0) + createdDelta),
    monthWorkCount: Math.max(0, Number(dashboard.monthWorkCount || 0) + createdDelta),
    deltas: { ...(dashboard.deltas || {}), pending: String(nextOpenWorks.length) }
  };
}

function workTone(work) {
  const text = `${work?.status || ""} ${work?.impact || ""}`.toLowerCase();
  if (/異常|逾期|緊急|urgent|critical/.test(text)) return "urgent";
  if (/進行|doing|處理中/.test(text)) return "active";
  return "normal";
}

function statusLabel(work) {
  const text = String(work?.status || "").trim();
  if (!text || text === "未完成" || text === "未開始") return "待處理";
  return text;
}

function followUpDateTone(value, today) {
  const date = String(value || "").slice(0, 10);
  if (!date) return "future";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "future";
}

export default function DashboardWorkPanel({ works, followUps, onNavigate, notify, onDashboardChange }) {
  const today = getTodayKey();
  const workRows = useMemo(() => Array.isArray(works) ? works : [], [works]);
  const followUpRows = useMemo(() => Array.isArray(followUps) ? followUps : [], [followUps]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(WORK_CATEGORIES[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [localOrder, setLocalOrder] = useState([]);
  const [draggedId, setDraggedId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [processingIds, setProcessingIds] = useState(() => new Set());
  const inputRef = useRef(null);
  const optimisticIdRef = useRef(0);
  const workIdsKey = workRows.map((work) => work.id).join("|");
  const visibleWorks = orderWorks(workRows, localOrder);

  useEffect(() => {
    let savedOrder = [];
    try {
      savedOrder = JSON.parse(window.localStorage.getItem(WORK_ORDER_STORAGE_KEY) || "[]");
    } catch {
      savedOrder = [];
    }
    const merged = mergeWorkOrder(savedOrder, workRows);
    setLocalOrder(merged);
    try {
      window.localStorage.setItem(WORK_ORDER_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Database order is still used when browser storage is unavailable.
    }
  }, [workIdsKey, workRows]);

  useEffect(() => {
    function handleMobileAction(event) {
      const action = event?.detail?.action;
      if (!["today", "focus", "add-work", "add-todo"].includes(action)) return;
      setIsAdding(action === "add-work" || action === "add-todo");
      document.getElementById("dashboard-work-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (action === "add-work" || action === "add-todo") window.setTimeout(() => inputRef.current?.focus(), 250);
    }
    window.addEventListener("dashboard-mobile-action", handleMobileAction);
    return () => window.removeEventListener("dashboard-mobile-action", handleMobileAction);
  }, []);

  function saveLocalOrder(nextOrder) {
    setLocalOrder(nextOrder);
    try {
      window.localStorage.setItem(WORK_ORDER_STORAGE_KEY, JSON.stringify(nextOrder));
    } catch {
      // The UI order remains active for this session.
    }
  }

  async function persistOrder(nextOrder) {
    try {
      await api("/api/work-logs/reorder", { method: "POST", body: JSON.stringify({ ids: nextOrder }) });
      notify?.({ tone: "success", message: "工作順序已同步" });
    } catch {
      notify?.({ tone: "success", message: "工作順序已保存在這台裝置" });
    }
  }

  function reorderWork(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const currentOrder = mergeWorkOrder(localOrder, workRows);
    const nextOrder = currentOrder.filter((id) => id !== sourceId);
    const targetIndex = nextOrder.indexOf(targetId);
    nextOrder.splice(targetIndex >= 0 ? targetIndex : nextOrder.length, 0, sourceId);
    saveLocalOrder(nextOrder);
    setDraggedId("");
    setDropTargetId("");
    persistOrder(nextOrder);
  }

  function moveWork(id, direction) {
    const currentOrder = mergeWorkOrder(localOrder, workRows);
    const index = currentOrder.indexOf(id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    saveLocalOrder(nextOrder);
    persistOrder(nextOrder);
  }

  function cancelAdd() {
    setTitle("");
    setCategory(WORK_CATEGORIES[0]);
    setIsAdding(false);
    setError("");
  }

  async function addWork(event) {
    event.preventDefault();
    if (!inputRef.current?.reportValidity()) return;
    const value = title.trim();
    if (!value) return;
    if (/^\d+$/.test(value)) {
      setError("工作內容不可只輸入數字，請補上可辨識的說明");
      return;
    }

    optimisticIdRef.current += 1;
    const temporaryId = `temp-work-${optimisticIdRef.current}`;
    const optimisticWork = {
      id: temporaryId,
      date: today,
      title: value,
      category,
      status: "未完成",
      created_at: new Date().toISOString()
    };
    setSaving(true);
    setError("");
    setTitle("");
    setIsAdding(false);
    onDashboardChange?.((current) => replaceOpenWorks(
      current,
      [optimisticWork, ...(current?.openWorks || [])],
      { createdDelta: 1 }
    ));

    try {
      const saved = await api("/api/work-logs", {
        method: "POST",
        body: JSON.stringify({ title: value, category, date: today, status: "未完成" })
      });
      onDashboardChange?.((current) => replaceOpenWorks(
        current,
        (current?.openWorks || []).map((work) => work.id === temporaryId ? saved : work)
      ));
      notify?.({ tone: "success", message: `已加入工作中心：${value}` });
    } catch (err) {
      onDashboardChange?.((current) => replaceOpenWorks(
        current,
        (current?.openWorks || []).filter((work) => work.id !== temporaryId),
        { createdDelta: -1 }
      ));
      setError(err.message || "新增工作失敗");
    } finally {
      setSaving(false);
      setCategory(WORK_CATEGORIES[0]);
    }
  }

  async function completeWork(work) {
    if (!work?.id || processingIds.has(work.id)) return;
    setError("");
    setProcessingIds((current) => new Set(current).add(work.id));
    onDashboardChange?.((current) => replaceOpenWorks(
      current,
      (current?.openWorks || []).filter((row) => row.id !== work.id),
      { completedDelta: 1 }
    ));
    try {
      await api("/api/work-logs", {
        method: "PATCH",
        body: JSON.stringify({ id: work.id, status: "已完成" })
      });
      notify?.({ tone: "success", message: `已完成：${work.title || "未命名工作"}` });
    } catch (err) {
      onDashboardChange?.((current) => replaceOpenWorks(
        current,
        [work, ...(current?.openWorks || []).filter((row) => row.id !== work.id)],
        { completedDelta: -1 }
      ));
      setError(err.message || "工作更新失敗");
    } finally {
      setProcessingIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });
    }
  }

  function openWork(work) {
    const query = encodeURIComponent(work?.title || "");
    onNavigate?.("work", { href: query ? `/work?q=${query}` : "/work" });
  }

  return (
    <div id="dashboard-work-center" className="dashboard-work-column">
      <section className="panel dashboard-work-block">
        <header className="dashboard-block-title">
          <div>
            <h2>未完成任務</h2>
            <span>{workRows.length} 件，拖曳即可排序</span>
          </div>
          <button className="dashboard-add-work-button" type="button" onClick={() => isAdding ? cancelAdd() : setIsAdding(true)} disabled={saving}>
            {isAdding ? "取消" : "＋ 新增任務"}
          </button>
        </header>

        {isAdding ? (
          <form className="dashboard-work-quick-add" onSubmit={addWork}>
            <input ref={inputRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={MAX_WORK_TITLE_LENGTH} placeholder="輸入工作內容" aria-label="工作內容" required autoFocus />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="工作類型">
              {WORK_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "儲存中" : "加入"}</button>
          </form>
        ) : null}
        {error ? <div className="dashboard-work-error">{error}</div> : null}

        <div className="dashboard-work-list">
          {visibleWorks.length ? visibleWorks.map((work, index) => {
            const tone = workTone(work);
            const processing = processingIds.has(work.id);
            return (
              <article
                className={`dashboard-work-row tone-${tone} ${draggedId === work.id ? "is-dragging" : ""} ${dropTargetId === work.id && draggedId !== work.id ? "is-drop-target" : ""}`}
                key={work.id}
                onDragEnter={() => draggedId && setDropTargetId(work.id)}
                onDragOver={(event) => { if (draggedId && draggedId !== work.id) { event.preventDefault(); setDropTargetId(work.id); } }}
                onDrop={(event) => { event.preventDefault(); reorderWork(draggedId, work.id); }}
              >
                <span
                  className="work-drag-handle"
                  draggable={!processing}
                  aria-label="拖曳調整工作順序"
                  title="拖曳排序"
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", work.id); setDraggedId(work.id); }}
                  onDragEnd={() => { setDraggedId(""); setDropTargetId(""); }}
                >⋮⋮</span>
                <button className={`circle work-complete-button ${processing ? "is-loading" : ""}`} type="button" onClick={() => completeWork(work)} disabled={processing} aria-label={`完成工作：${work.title || "未命名工作"}`} />
                <button className="dashboard-work-row-main" type="button" onClick={() => openWork(work)}>
                  <strong>{work.title || "未命名工作"}</strong>
                  <small>{work.category || "一般"} · {formatRelativeDate(work.date || work.created_at)}</small>
                </button>
                <span className={`work-status-chip tone-${tone}`}>{statusLabel(work)}</span>
                <span className="work-order-actions" aria-label="調整工作順序">
                  <button type="button" onClick={() => moveWork(work.id, -1)} disabled={index === 0} aria-label="向上移動">↑</button>
                  <button type="button" onClick={() => moveWork(work.id, 1)} disabled={index === visibleWorks.length - 1} aria-label="向下移動">↓</button>
                </span>
              </article>
            );
          }) : <div className="dashboard-block-empty">目前沒有未完成任務</div>}
        </div>

        <button className="dashboard-block-link" type="button" onClick={() => onNavigate?.("work")}>
          前往工作中心查看全部工作 →
        </button>
      </section>

      <section className="panel dashboard-follow-block">
        <header className="dashboard-block-title compact">
          <div><h2>待追蹤</h2><span>{followUpRows.length} 件</span></div>
          <button className="dashboard-block-text-button" type="button" onClick={() => onNavigate?.("follow-ups")}>查看全部</button>
        </header>
        <div className="dashboard-follow-list-new">
          {followUpRows.length ? followUpRows.map((item) => {
            const dateTone = followUpDateTone(item.next_follow_date, today);
            return (
              <button className={`dashboard-follow-row date-${dateTone}`} type="button" key={item.id} onClick={() => onNavigate?.("follow-ups")}>
                <span aria-hidden="true" />
                <strong>{item.title || "未命名追蹤事項"}</strong>
                <small>{item.current_status || "等待回覆"}</small>
                <time dateTime={formatDate(item.next_follow_date)}>{formatRelativeDate(item.next_follow_date)}</time>
              </button>
            );
          }) : <div className="dashboard-block-empty compact">目前沒有待追蹤項目</div>}
        </div>
      </section>
    </div>
  );
}
