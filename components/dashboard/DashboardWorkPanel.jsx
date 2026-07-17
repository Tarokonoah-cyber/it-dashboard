"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/dashboard-api";
import { formatDate, formatRelativeDate, getTodayKey } from "../../lib/dashboard-formatters";
import { getWorkPriorityLabel } from "../../lib/dashboard-metrics";
import { loadRelatedFollowUps, settleWorkFollowUps } from "../../lib/work-completion-client";
import { getTomorrowDate } from "../../lib/work-follow-up";
import WorkCompletionDialog from "../WorkCompletionDialog";

const MAX_WORK_TITLE_LENGTH = 200;
const WORK_ORDER_STORAGE_KEY = "dashboard-work-order-v1";
const WORK_PRIORITIES = ["一般", "重要"];

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
  const monthCompletedDelta = Number(options.monthCompletedDelta || 0);
  const createdDelta = Number(options.createdDelta || 0);
  const monthCompletedCount = Math.max(0, Number(dashboard.monthCompletedCount || 0) + monthCompletedDelta);
  const monthCompletionTotal = Math.max(0, Number(dashboard.monthCompletionTotal ?? dashboard.monthWorkCount ?? 0) + createdDelta);
  const monthCompletionRate = monthCompletionTotal ? Math.round((monthCompletedCount / monthCompletionTotal) * 100) : 0;
  return {
    ...dashboard,
    openWorks: nextOpenWorks,
    pendingCount: nextOpenWorks.length,
    completedCount: Math.max(0, Number(dashboard.completedCount || 0) + completedDelta),
    importantCount: nextOpenWorks.filter((work) => getWorkPriorityLabel(work) === "重要").length,
    completionRate: monthCompletionRate,
    monthCompletedCount,
    monthCompletionTotal,
    monthCompletionRate,
    todayWorkCount: Math.max(0, Number(dashboard.todayWorkCount || 0) + createdDelta),
    monthWorkCount: Math.max(0, Number(dashboard.monthWorkCount || 0) + createdDelta),
    deltas: { ...(dashboard.deltas || {}), pending: String(nextOpenWorks.length) }
  };
}

function workTone(work) {
  const text = String(work?.status || "").toLowerCase();
  if (getWorkPriorityLabel(work) === "重要") return "important";
  if (/進行|doing|處理中/.test(text)) return "active";
  return "normal";
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
  const [priority, setPriority] = useState(WORK_PRIORITIES[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [localOrder, setLocalOrder] = useState([]);
  const [draggedId, setDraggedId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [processingIds, setProcessingIds] = useState(() => new Set());
  const [editingWorkId, setEditingWorkId] = useState("");
  const [editWorkForm, setEditWorkForm] = useState({ title: "", priority: WORK_PRIORITIES[0] });
  const [editSaving, setEditSaving] = useState(false);
  const [completionWork, setCompletionWork] = useState(null);
  const [completionRelated, setCompletionRelated] = useState([]);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionSaving, setCompletionSaving] = useState(false);
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
      notify?.({ tone: "error", message: "工作順序暫時無法同步，請再試一次" });
    }
  }

  function reorderWork(sourceId, targetId) {
    sourceId = String(sourceId || "");
    targetId = String(targetId || "");
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

  async function deleteWork(work) {
    if (!work?.id || processingIds.has(work.id)) return;
    const label = work.title || "未命名工作";
    if (!window.confirm(`確定刪除「${label}」嗎？刪除後無法復原。`)) return;

    setProcessingIds((current) => new Set(current).add(work.id));
    setError("");
    try {
      await api(`/api/work-logs?id=${encodeURIComponent(work.id)}`, { method: "DELETE" });
      onDashboardChange?.((current) => replaceOpenWorks(
        current,
        (current?.openWorks || []).filter((row) => row.id !== work.id)
      ));
      saveLocalOrder(localOrder.filter((id) => id !== String(work.id)));
      notify?.({ tone: "success", message: `已刪除：${label}` });
      window.dispatchEvent(new CustomEvent("dashboard-data-changed", { detail: { type: "work-deleted", id: work.id } }));
    } catch (err) {
      setError(err.message || "刪除工作失敗");
    } finally {
      setProcessingIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });
    }
  }

  function startEditingWork(work) {
    if (!work?.id || processingIds.has(work.id) || String(work.id).startsWith("temp-work-")) return;
    setError("");
    setEditingWorkId(work.id);
    setEditWorkForm({
      title: String(work.title || ""),
      priority: getWorkPriorityLabel(work)
    });
  }

  function cancelEditingWork() {
    if (editSaving) return;
    setEditingWorkId("");
    setEditWorkForm({ title: "", priority: WORK_PRIORITIES[0] });
  }

  async function saveWorkEdit(event, work) {
    event.preventDefault();
    const nextTitle = editWorkForm.title.trim();
    if (!nextTitle || /^\d+$/.test(nextTitle) || editSaving) {
      setError(!nextTitle ? "請輸入工作內容" : "工作內容不能只有數字");
      return;
    }

    setEditSaving(true);
    setProcessingIds((current) => new Set(current).add(work.id));
    setError("");
    try {
      await api("/api/work-logs", {
        method: "PATCH",
        body: JSON.stringify({ id: work.id, title: nextTitle, impact: editWorkForm.priority })
      });
      onDashboardChange?.((current) => replaceOpenWorks(
        current,
        (current?.openWorks || []).map((row) => row.id === work.id
          ? { ...row, title: nextTitle, impact: editWorkForm.priority }
          : row)
      ));
      notify?.({ tone: "success", message: `已更新：${nextTitle}` });
      setEditingWorkId("");
      setEditWorkForm({ title: "", priority: WORK_PRIORITIES[0] });
    } catch (err) {
      setError(err.message || "更新工作失敗");
    } finally {
      setEditSaving(false);
      setProcessingIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });
    }
  }

  function cancelAdd() {
    setTitle("");
    setPriority(WORK_PRIORITIES[0]);
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
      category: "工作",
      impact: priority,
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
        body: JSON.stringify({ title: value, category: "工作", impact: priority, date: today, status: "未完成" })
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
      setPriority(WORK_PRIORITIES[0]);
    }
  }

  async function prepareWorkCompletion(work) {
    if (!work?.id || processingIds.has(work.id) || completionWork) return;
    setCompletionWork(work);
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
  }

  async function confirmWorkCompletion(choice) {
    const work = completionWork;
    if (!work?.id || processingIds.has(work.id) || completionSaving) return;
    setCompletionSaving(true);
    setProcessingIds((current) => new Set(current).add(work.id));
    setError("");
    let workSaved = false;
    try {
      await api("/api/work-logs", {
        method: "PATCH",
        body: JSON.stringify({ id: work.id, status: "已完成" })
      });
      workSaved = true;
      onDashboardChange?.((current) => replaceOpenWorks(
        current,
        (current?.openWorks || []).filter((row) => row.id !== work.id),
        {
          completedDelta: 1,
          monthCompletedDelta: String(work.date || work.created_at || "").slice(0, 7) === today.slice(0, 7) ? 1 : 0
        }
      ));
      const result = await settleWorkFollowUps({ work, related: completionRelated, ...choice });
      const message = result.closedCount
        ? `已完成工作，並關閉 ${result.closedCount} 筆相關追蹤`
        : result.created
          ? `已完成工作並轉為待追蹤：${work.title || "未命名工作"}`
          : result.keptCount
            ? `已完成工作，保留 ${result.keptCount} 筆待追蹤`
            : `已完成：${work.title || "未命名工作"}`;
      notify?.({ tone: "success", message });
    } catch (err) {
      setError(workSaved ? `工作已完成，但待追蹤處理失敗：${err.message}` : (err.message || "工作更新失敗"));
    } finally {
      if (workSaved) window.dispatchEvent(new CustomEvent("dashboard-data-changed", { detail: { type: "work-completed", id: work.id } }));
      setProcessingIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });
      setCompletionWork(null);
      setCompletionRelated([]);
      setCompletionSaving(false);
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
            <span>{workRows.length} 件</span>
          </div>
          <div className="dashboard-block-actions">
            <button className="dashboard-block-text-button" type="button" onClick={() => onNavigate?.("work")}>
              查看全部
            </button>
            <button className="dashboard-add-work-button" type="button" onClick={() => isAdding ? cancelAdd() : setIsAdding(true)} disabled={saving}>
              {isAdding ? "取消" : "＋ 新增任務"}
            </button>
          </div>
        </header>

        {isAdding ? (
          <form className="dashboard-work-quick-add" onSubmit={addWork}>
            <input ref={inputRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={MAX_WORK_TITLE_LENGTH} placeholder="輸入工作內容" aria-label="工作內容" required autoFocus />
            <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="任務重要程度">
              {WORK_PRIORITIES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "儲存中" : "加入"}</button>
          </form>
        ) : null}
        {error ? <div className="dashboard-work-error">{error}</div> : null}

        <div className="dashboard-work-list">
          {visibleWorks.length ? visibleWorks.map((work) => {
            const tone = workTone(work);
            const temporary = String(work.id).startsWith("temp-work-");
            const processing = processingIds.has(work.id) || completionWork?.id === work.id || temporary;
            const editing = editingWorkId === work.id;
            return (
              <article
                className={`dashboard-work-row tone-${tone} ${editing ? "is-editing" : ""} ${draggedId === work.id ? "is-dragging" : ""} ${dropTargetId === work.id && draggedId !== work.id ? "is-drop-target" : ""}`}
                key={work.id}
                onDragEnter={() => draggedId && setDropTargetId(work.id)}
                onDragOver={(event) => { if (draggedId && draggedId !== work.id) { event.preventDefault(); setDropTargetId(work.id); } }}
                onDrop={(event) => {
                  event.preventDefault();
                  reorderWork(event.dataTransfer.getData("text/plain") || draggedId, work.id);
                }}
              >
                <span
                  className="work-drag-handle"
                  draggable={!processing && !editing}
                  aria-label="拖曳調整工作順序"
                  title="拖曳排序"
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", work.id); setDraggedId(work.id); }}
                  onDragEnd={() => { setDraggedId(""); setDropTargetId(""); }}
                >⋮⋮</span>
                <button className={`circle work-complete-button ${processing ? "is-loading" : ""}`} type="button" onClick={() => prepareWorkCompletion(work)} disabled={processing} aria-label={`完成工作：${work.title || "未命名工作"}`} />
                {editing ? (
                  <form className="work-inline-edit" onSubmit={(event) => saveWorkEdit(event, work)}>
                    <input
                      value={editWorkForm.title}
                      onChange={(event) => setEditWorkForm((current) => ({ ...current, title: event.target.value }))}
                      maxLength={MAX_WORK_TITLE_LENGTH}
                      aria-label="工作內容"
                      required
                      autoFocus
                    />
                    <div className="work-inline-edit-footer">
                      <select
                        value={editWorkForm.priority}
                        onChange={(event) => setEditWorkForm((current) => ({ ...current, priority: event.target.value }))}
                        aria-label="任務重要程度"
                      >
                        {WORK_PRIORITIES.map((item) => <option key={item}>{item}</option>)}
                      </select>
                      <span>
                        <button type="button" onClick={cancelEditingWork} disabled={editSaving}>取消</button>
                        <button className="primary-action" type="submit" disabled={editSaving}>{editSaving ? "儲存中" : "儲存"}</button>
                      </span>
                    </div>
                  </form>
                ) : (
                  <>
                    <button className="dashboard-work-row-main" type="button" onClick={() => openWork(work)}>
                      <strong>{work.title || "未命名工作"}</strong>
                      <small>{getWorkPriorityLabel(work)} · {formatRelativeDate(work.date || work.created_at)}</small>
                    </button>
                    <span className="work-row-actions" aria-label="工作操作">
                      <button type="button" onClick={() => startEditingWork(work)} disabled={processing}>快速修改</button>
                      <button className="danger" type="button" onClick={() => deleteWork(work)} disabled={processing}>刪除</button>
                    </span>
                  </>
                )}
              </article>
            );
          }) : <div className="dashboard-block-empty">目前沒有未完成任務</div>}
        </div>

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
                <span className="dashboard-follow-rail" aria-hidden="true" />
                <span className="dashboard-follow-content">
                  <strong>{item.title || "未命名追蹤事項"}</strong>
                  <small>{item.current_status || "等待回覆"}</small>
                </span>
                <time dateTime={formatDate(item.next_follow_date)}>{formatRelativeDate(item.next_follow_date)}</time>
              </button>
            );
          }) : <div className="dashboard-block-empty compact">目前沒有待追蹤項目</div>}
        </div>
      </section>

      <WorkCompletionDialog
        work={completionWork}
        related={completionRelated}
        defaultDate={getTomorrowDate(today)}
        loading={completionLoading}
        saving={completionSaving}
        onCancel={() => { if (!completionSaving) { setCompletionWork(null); setCompletionRelated([]); } }}
        onConfirm={confirmWorkCompletion}
      />
    </div>
  );
}
