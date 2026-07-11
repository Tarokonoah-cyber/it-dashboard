"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import CompletionSummaryItem from "./dashboard/CompletionSummaryItem";
import DashboardCalendarPanel from "./dashboard/DashboardCalendarPanel";
import DashboardToast from "./dashboard/DashboardToast";
import KpiSummaryItem from "./dashboard/KpiSummaryItem";
import { getSectionHref } from "./navigation";
import { api } from "../lib/dashboard-api";
import {
  formatDate,
  formatRelativeDate,
  getTodayKey,
  normalizeTodoPriority,
  parseDelta
} from "../lib/dashboard-formatters";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MAX_TODO_TITLE_LENGTH = 120;
const TODO_COMPLETE_EXIT_MS = 600;
const TODO_ORDER_STORAGE_KEY = "dashboard-todo-order-v1";
const FOLLOW_UP_STATUSES = ["等待回覆", "處理中", "待確認", "已完成"];

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || "").trim());
}

function formatWorkTitle(work) {
  const title = String(work.title || "").trim();
  const description = String(work.description || "").trim();
  if (/^\d+$/.test(title) && description) return description;
  return title || description || "未命名工作";
}

const TODO_PRIORITY_OPTIONS = [
  { value: "一般", label: "一般", tone: "normal" },
  { value: "重要", label: "重要", tone: "medium" },
  { value: "緊急", label: "緊急", tone: "urgent" }
];

function mergeTodoOrder(savedOrder, rows) {
  const ids = (rows || []).map((row) => String(row.id || "")).filter(Boolean);
  const idSet = new Set(ids);
  const kept = (Array.isArray(savedOrder) ? savedOrder : []).map(String).filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...ids.filter((id) => !keptSet.has(id))];
}

function orderTodos(rows, order) {
  const list = Array.isArray(rows) ? rows : [];
  if (!order?.length) return list;
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...list].sort((left, right) => {
    const leftOrder = orderMap.has(left.id) ? orderMap.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightOrder = orderMap.has(right.id) ? orderMap.get(right.id) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return 0;
  });
}

function updateDashboardTodosState(dashboard, updater, countDelta = 0, completedDelta = 0) {
  if (!dashboard) return dashboard;
  const openTodos = Array.isArray(dashboard.openTodos) ? dashboard.openTodos : [];
  const nextTodos = updater(openTodos);
  const pendingCount = nextTodos.length;
  return {
    ...dashboard,
    openTodos: nextTodos,
    pendingCount,
    completedCount: Math.max(0, Number(dashboard.completedCount || 0) + completedDelta),
    todayWorkCount: Math.max(0, Number(dashboard.todayWorkCount || 0) + countDelta),
    monthWorkCount: Math.max(0, Number(dashboard.monthWorkCount || 0) + countDelta),
    deltas: {
      ...(dashboard.deltas || {}),
      pending: `${pendingCount}`
    }
  };
}

function DashboardTodoPanel({ todos, followUps, onReload, onNavigate, notify, onDashboardChange }) {
  const todayKey = getTodayKey();
  const todoRows = Array.isArray(todos) ? todos : [];
  const followUpRows = Array.isArray(followUps) ? followUps : [];
  const [activeTab, setActiveTab] = useState("todos");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [localTodoOrder, setLocalTodoOrder] = useState([]);
  const [draggedTodoId, setDraggedTodoId] = useState("");
  const [dropTargetTodoId, setDropTargetTodoId] = useState("");
  const [editingTodoId, setEditingTodoId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("一般");
  const [processingTodoIds, setProcessingTodoIds] = useState(() => new Set());
  const [completedTodoIds, setCompletedTodoIds] = useState(() => new Set());
  const [fadingTodoIds, setFadingTodoIds] = useState(() => new Set());
  const [completionTodo, setCompletionTodo] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [followForm, setFollowForm] = useState({
    current_status: "等待回覆",
    next_follow_date: todayKey,
    note: ""
  });
  const todoInputRef = useRef(null);
  const todoIdsKey = todoRows.map((todo) => todo.id).join("|");
  const visibleTodos = orderTodos(todoRows, localTodoOrder);
  const visibleFollowUps = followUpRows;
  const todoSourceIds = todoRows.map((todo) => todo.id).filter(Boolean).join(",");
  const todoWorkHref = todoSourceIds
    ? `/work?source=todo_logs&sourceIds=${encodeURIComponent(todoSourceIds)}`
    : "/work?source=todo_logs";

  useEffect(() => {
    let savedOrder = [];
    try {
      savedOrder = JSON.parse(window.localStorage.getItem(TODO_ORDER_STORAGE_KEY) || "[]");
    } catch {
      savedOrder = [];
    }
    const merged = mergeTodoOrder(savedOrder, todoRows);
    setLocalTodoOrder(merged);
    try {
      window.localStorage.setItem(TODO_ORDER_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Local storage is optional; database persistence still handles shared order.
    }
  }, [todoIdsKey]);

  function addTodoState(setter, id) {
    setter((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  function removeTodoState(setter, id) {
    setter((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function addTodo() {
    if (!todoInputRef.current?.reportValidity()) return;
    const value = title.trim();
    if (!value) return;
    if (value.length > MAX_TODO_TITLE_LENGTH) {
      window.alert(`Todo title must be ${MAX_TODO_TITLE_LENGTH} characters or less`);
      return;
    }
    const tempId = `temp-todo-${Date.now()}`;
    const optimisticTodo = {
      id: tempId,
      title: value,
      priority: "一般",
      status: "待辦",
      due_date: todayKey,
      created_at: new Date().toISOString()
    };
    setTitle("");
    setIsAdding(false);
    onDashboardChange?.((current) => updateDashboardTodosState(
      current,
      (rows) => [optimisticTodo, ...rows],
      1
    ));
    setSaving(true);
    setError("");
    try {
      const nextTodo = await api("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: value })
      });
      onDashboardChange?.((current) => updateDashboardTodosState(
        current,
        (rows) => rows.map((todo) => todo.id === tempId ? { ...optimisticTodo, ...nextTodo } : todo)
      ));
      notify?.({ tone: "success", message: `已新增：${value}` });
    } catch (err) {
      onDashboardChange?.((current) => updateDashboardTodosState(
        current,
        (rows) => rows.filter((todo) => todo.id !== tempId),
        -1
      ));
      setError(err.message || "Todo 新增失敗");
    } finally {
      setSaving(false);
    }
  }

  function cancelAddTodo() {
    setTitle("");
    setIsAdding(false);
  }

  function openCompleteChoice(todo) {
    if (!todo?.id || processingTodoIds.has(todo.id) || completedTodoIds.has(todo.id)) return;
    setCompletionTodo(todo);
    setIsConverting(false);
    setFollowForm({
      current_status: "等待回覆",
      next_follow_date: todayKey,
      note: ""
    });
    setError("");
  }

  function closeCompleteChoice() {
    if (saving) return;
    setCompletionTodo(null);
    setIsConverting(false);
  }

  async function completeTodo(todo) {
    const id = todo?.id;
    if (!id || processingTodoIds.has(id) || completedTodoIds.has(id)) return;
    setError("");
    setCompletionTodo(null);
    setIsConverting(false);
    onDashboardChange?.((current) => updateDashboardTodosState(
      current,
      (rows) => rows.filter((row) => row.id !== id),
      -1,
      1
    ));
    try {
      await api("/api/todos", {
        method: "PATCH",
        body: JSON.stringify({ id, status: "已完成" })
      });
      notify?.({ tone: "success", message: `已完成：${todo.title || "未命名待辦"}` });
    } catch (err) {
      onDashboardChange?.((current) => updateDashboardTodosState(
        current,
        (rows) => [todo, ...rows],
        1,
        -1
      ));
      setError(err.message || "Todo 更新失敗");
      notify?.({ tone: "error", message: "更新失敗，請稍後再試" });
    }
  }

  async function convertTodoToFollowUp(event) {
    event.preventDefault();
    const todo = completionTodo;
    if (!todo?.id) return;
    setSaving(true);
    setError("");
    addTodoState(setProcessingTodoIds, todo.id);
    try {
      await api("/api/follow-ups", {
        method: "POST",
        body: JSON.stringify({
          source_todo_id: todo.id,
          title: todo.title || "未命名待辦",
          current_status: followForm.current_status,
          next_follow_date: followForm.next_follow_date,
          note: followForm.note
        })
      });
      notify?.({ tone: "success", message: `已轉為待追蹤：${todo.title || "未命名待辦"}` });
      setCompletionTodo(null);
      setIsConverting(false);
      setActiveTab("follow-ups");
      await onReload();
    } catch (err) {
      setError(err.message || "轉為待追蹤失敗");
      notify?.({ tone: "error", message: "轉為待追蹤失敗，請稍後再試" });
    } finally {
      removeTodoState(setProcessingTodoIds, todo.id);
      setSaving(false);
    }
  }

  function startEditTodo(row) {
    setEditingTodoId(row.id);
    setEditTitle(row.title || "");
    setEditPriority(row.priority || "一般");
    setError("");
  }

  function cancelEditTodo() {
    setEditingTodoId("");
    setEditTitle("");
    setEditPriority("一般");
  }

  async function saveEditTodo(row) {
    const nextTitle = editTitle.trim();
    if (!nextTitle) return;
    if (nextTitle.length > MAX_TODO_TITLE_LENGTH) {
      window.alert(`Todo title must be ${MAX_TODO_TITLE_LENGTH} characters or less`);
      return;
    }
    setError("");
    setSaving(true);
    const originalTodo = row;
    onDashboardChange?.((current) => updateDashboardTodosState(
      current,
      (rows) => rows.map((todo) => todo.id === row.id ? { ...todo, title: nextTitle, priority: editPriority } : todo)
    ));
    cancelEditTodo();
    try {
      const nextTodo = await api("/api/todos", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, title: nextTitle, priority: editPriority })
      });
      onDashboardChange?.((current) => updateDashboardTodosState(
        current,
        (rows) => rows.map((todo) => todo.id === row.id ? { ...todo, ...nextTodo } : todo)
      ));
      notify?.({ tone: "success", message: `已更新：${nextTitle}` });
    } catch (err) {
      onDashboardChange?.((current) => updateDashboardTodosState(
        current,
        (rows) => rows.map((todo) => todo.id === row.id ? originalTodo : todo)
      ));
      setError(err.message || "Todo 更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTodo(todo) {
    const id = todo?.id;
    if (!id) return;
    if (!window.confirm("確定要刪除這筆待辦？")) return;
    setError("");
    onDashboardChange?.((current) => updateDashboardTodosState(
      current,
      (rows) => rows.filter((row) => row.id !== id),
      -1
    ));
    try {
      await api(`/api/todos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      notify?.({ tone: "success", message: `已刪除：${todo.title || "未命名待辦"}` });
    } catch (err) {
      onDashboardChange?.((current) => updateDashboardTodosState(
        current,
        (rows) => [todo, ...rows],
        1
      ));
      setError(err.message || "Todo 刪除失敗");
    }
  }

  function saveLocalTodoOrder(nextOrder) {
    setLocalTodoOrder(nextOrder);
    try {
      window.localStorage.setItem(TODO_ORDER_STORAGE_KEY, JSON.stringify(nextOrder));
    } catch {
      // Ignore local storage failures; the server reorder call below is the source of truth.
    }
  }

  async function persistTodoOrder(nextOrder) {
    try {
      await api("/api/todos/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: nextOrder })
      });
      notify?.({ tone: "success", message: "待辦順序已更新" });
    } catch (err) {
      setError(err.message || "Todo 排序儲存失敗");
      notify?.({ tone: "error", message: "排序已先套用在此瀏覽器，資料庫欄位建立後即可同步保存。" });
    }
  }

  function reorderTodo(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const currentOrder = mergeTodoOrder(localTodoOrder, todoRows);
    const nextOrder = currentOrder.filter((id) => id !== sourceId);
    const targetIndex = nextOrder.indexOf(targetId);
    nextOrder.splice(targetIndex >= 0 ? targetIndex : nextOrder.length, 0, sourceId);
    saveLocalTodoOrder(nextOrder);
    setDraggedTodoId("");
    setDropTargetTodoId("");
    persistTodoOrder(nextOrder);
  }

  return (
    <section className="panel dashboard-todo-panel">
      <header className="panel-title">
        <div>
          <h2>Todo List</h2>
        </div>
        <button
          onClick={() => (isAdding ? cancelAddTodo() : setIsAdding(true))}
          disabled={saving || activeTab !== "todos"}
          aria-label={isAdding ? "取消新增待辦" : "新增待辦"}
          title={isAdding ? "取消" : "新增"}
        >
          {isAdding ? "×" : "+"}
        </button>
      </header>
      <div className="todo-card-tabs" role="tablist" aria-label="Todo List 分頁">
        <button
          type="button"
          className={activeTab === "todos" ? "active" : ""}
          onClick={() => setActiveTab("todos")}
        >
          <span>待辦事項</span>
          <b>{todoRows.length}</b>
        </button>
        <button
          type="button"
          className={activeTab === "follow-ups" ? "active" : ""}
          onClick={() => setActiveTab("follow-ups")}
        >
          <span>待追蹤</span>
          <b>{followUpRows.length}</b>
        </button>
      </div>
      {isAdding && activeTab === "todos" ? (
        <div className="todo-quick-add dashboard-todo-input is-expanded">
          <input
            ref={todoInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addTodo()}
            maxLength={MAX_TODO_TITLE_LENGTH}
            required
            placeholder="輸入新的待辦事項..."
            autoFocus
          />
          <button className="todo-save-button" type="button" onClick={addTodo} disabled={saving}>
            {saving ? "儲存中" : "儲存"}
          </button>
          <button className="todo-cancel-button" type="button" onClick={cancelAddTodo} disabled={saving}>
            取消
          </button>
        </div>
      ) : null}
      {error ? <div className="error-box">{error}</div> : null}
      {activeTab === "todos" ? (
        <>
          <div className="dashboard-todo-list">
            {todoRows.length === 0 ? (
              <div className="empty">目前沒有待辦項目</div>
            ) : (
              visibleTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  isProcessing={processingTodoIds.has(todo.id)}
                  isCompleted={completedTodoIds.has(todo.id)}
                  isFading={fadingTodoIds.has(todo.id)}
                  isEditing={editingTodoId === todo.id}
                  editTitle={editTitle}
                  editPriority={editPriority}
                  onEditTitleChange={setEditTitle}
                  onEditPriorityChange={setEditPriority}
                  onComplete={() => openCompleteChoice(todo)}
                  onEdit={() => startEditTodo(todo)}
                  onCancelEdit={cancelEditTodo}
                  onSaveEdit={() => saveEditTodo(todo)}
                  onEditKeyDown={(event) => {
                    if (event.key === "Enter") saveEditTodo(todo);
                    if (event.key === "Escape") cancelEditTodo();
                  }}
                  onDelete={() => deleteTodo(todo)}
                  isSaving={saving}
                  isDragging={draggedTodoId === todo.id}
                  isDropTarget={dropTargetTodoId === todo.id && draggedTodoId !== todo.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", todo.id);
                    setDraggedTodoId(todo.id);
                    setDropTargetTodoId("");
                  }}
                  onDragEnter={() => draggedTodoId && setDropTargetTodoId(todo.id)}
                  onDragOver={(event) => {
                    if (!draggedTodoId || draggedTodoId === todo.id) return;
                    event.preventDefault();
                    setDropTargetTodoId(todo.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorderTodo(draggedTodoId, todo.id);
                  }}
                  onDragEnd={() => {
                    setDraggedTodoId("");
                    setDropTargetTodoId("");
                  }}
                />
              ))
            )}
          </div>
          {todoRows.length > 0 ? (
            <button className="panel-link todo-view-all" type="button" onClick={() => onNavigate?.("work", { href: todoWorkHref })}>
              查看全部 {todoRows.length} 筆 →
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div className="dashboard-follow-list">
            {visibleFollowUps.length === 0 ? (
              <div className="empty">目前沒有待追蹤項目</div>
            ) : (
              visibleFollowUps.map((item) => <FollowUpCompactRow key={item.id} item={item} />)
            )}
          </div>
          {followUpRows.length > 0 ? (
            <button className="panel-link todo-view-all" type="button" onClick={() => onNavigate?.("follow-ups")}>
              查看全部 {followUpRows.length} 筆 →
            </button>
          ) : null}
        </>
      )}
      {completionTodo ? (
        <div className="todo-complete-backdrop" role="presentation" onMouseDown={closeCompleteChoice}>
          <div className="todo-complete-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h3>{completionTodo.title || "未命名待辦"}</h3>
                <span>選擇完成方式</span>
              </div>
              <button type="button" aria-label="關閉" onClick={closeCompleteChoice}>×</button>
            </header>
            {isConverting ? (
              <form onSubmit={convertTodoToFollowUp}>
                <label>
                  目前狀況
                  <select
                    value={followForm.current_status}
                    onChange={(event) => setFollowForm((current) => ({ ...current, current_status: event.target.value }))}
                  >
                    {FOLLOW_UP_STATUSES.filter((status) => status !== "已完成").map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  下次追蹤日
                  <input
                    type="date"
                    value={followForm.next_follow_date}
                    onChange={(event) => setFollowForm((current) => ({ ...current, next_follow_date: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  備註
                  <textarea
                    value={followForm.note}
                    onChange={(event) => setFollowForm((current) => ({ ...current, note: event.target.value }))}
                    rows={3}
                  />
                </label>
                <footer>
                  <button type="button" onClick={() => setIsConverting(false)} disabled={saving}>返回</button>
                  <button className="primary-action" type="submit" disabled={saving || !followForm.next_follow_date}>
                    {saving ? "儲存中" : "轉為待追蹤"}
                  </button>
                </footer>
              </form>
            ) : (
              <div className="todo-complete-choice">
                <button className="primary-action" type="button" onClick={() => completeTodo(completionTodo)} disabled={saving}>
                  直接完成
                </button>
                <button type="button" onClick={() => setIsConverting(true)} disabled={saving}>
                  轉為待追蹤
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FollowUpCompactRow({ item }) {
  return (
    <article className="dashboard-follow-row">
      <strong>{item.title || "未命名追蹤事項"}</strong>
      <span>{item.current_status || "等待回覆"}</span>
      <time>{formatDate(item.next_follow_date)}</time>
    </article>
  );
}

function TodoRow({
  todo,
  isProcessing,
  isCompleted,
  isFading,
  isEditing,
  editTitle,
  editPriority,
  onEditTitleChange,
  onEditPriorityChange,
  onComplete,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onEditKeyDown,
  onDelete,
  isSaving,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd
}) {
  const disabled = isProcessing || isCompleted || isFading;
  const priorityTone = normalizeTodoPriority(todo.priority);
  const priorityLabel = priorityTone === "urgent" ? "緊急" : priorityTone === "medium" ? "重要" : "一般";

  return (
    <article
      className={`dashboard-todo-row priority-${priorityTone} ${isEditing ? "is-editing" : ""} ${isProcessing ? "is-processing" : ""} ${isCompleted ? "is-completed" : ""} ${isFading ? "is-fading" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span
        className="todo-priority-drag-strip"
        role="button"
        tabIndex={0}
        draggable={!disabled && !isEditing}
        aria-label="拖曳調整待辦順序"
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
      <button
        className={`circle todo-check ${isProcessing ? "is-loading" : ""} ${isCompleted ? "is-done" : ""}`}
        onClick={onComplete}
        disabled={disabled}
        aria-label={isProcessing ? "待辦處理中" : isCompleted ? "待辦已完成" : "完成待辦"}
      />
      <div className="todo-row-main">
        {isEditing ? (
          <div className="todo-inline-edit">
            <input
              value={editTitle}
              onChange={(event) => onEditTitleChange(event.target.value)}
              onKeyDown={onEditKeyDown}
              maxLength={MAX_TODO_TITLE_LENGTH}
              aria-label="修改待辦內容"
              autoFocus
            />
            <select
              value={editPriority}
              onChange={(event) => onEditPriorityChange(event.target.value)}
              onKeyDown={onEditKeyDown}
              aria-label="調整緊急程度"
            >
              {TODO_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ) : (
          <strong>{todo.title || "未命名待辦"}</strong>
        )}
      </div>
      {!isEditing ? <span className={`todo-priority-chip tone-${priorityTone}`}>{priorityLabel}</span> : null}
      <div className="row-actions">
        {isEditing ? (
          <button className="todo-edit-done" onClick={onSaveEdit} disabled={isSaving || !editTitle.trim()} aria-label="儲存待辦" title="儲存">
            完成
          </button>
        ) : (
          <>
            <button className="icon-action" onClick={onEdit} disabled={disabled || isSaving} aria-label="修改待辦內容" title="修改">
              ✎
            </button>
            <button className="icon-action danger" onClick={onDelete} disabled={disabled || isSaving} aria-label="刪除待辦" title="刪除">
              ×
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function DashboardWorkTable({ works, onNavigate }) {
  return (
    <section className="panel dashboard-recent-panel">
      <header className="panel-title">
        <div>
          <h2>最近工作紀錄</h2>
          <span>最新 4 筆</span>
        </div>
        <button className="panel-text-button" type="button" onClick={() => onNavigate?.("work")}>查看全部</button>
      </header>
      <div className="work-table dashboard-work-table">
        <div className="work-row head">
          <span>編號</span>
          <span>日期</span>
          <span>標題</span>
          <span>類型</span>
          <span>狀態</span>
        </div>
        {works.length ? works.slice(0, 4).map((work) => (
          <div className="work-row" key={work.id}>
            <span>{work.id || "-"}</span>
            <span title={formatDate(work.date || work.created_at)}>{formatRelativeDate(work.date || work.created_at)}</span>
            <strong>{formatWorkTitle(work)}</strong>
            <span>{work.category || work.type || "工作"}</span>
            <b className={isDoneStatus(work.status) ? "status-done" : "status-pending"}>{work.status || "待辦"}</b>
          </div>
        )) : <div className="empty">目前沒有工作紀錄</div>}
      </div>
    </section>
  );
}

function DashboardTrendPanel({ trend }) {
  const safeTrend = Array.isArray(trend) ? trend.slice(-7) : [];
  if (!safeTrend.some((item) => Number(item.count) > 0)) return null;
  const max = Math.max(1, ...safeTrend.map((item) => Number(item.count) || 0));
  const chartWidth = 700;
  const chartHeight = 154;
  const padX = 18;
  const padTop = 18;
  const padBottom = 24;
  const plotHeight = chartHeight - padTop - padBottom;
  const points = safeTrend.map((item, index) => {
    const count = Number(item.count) || 0;
    const x = safeTrend.length <= 1 ? padX : padX + (index / (safeTrend.length - 1)) * (chartWidth - padX * 2);
    const y = padTop + plotHeight - (count / max) * plotHeight;
    return { ...item, count, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = chartHeight - padBottom;
  const area = points.length ? `${padX},${baseline} ${polyline} ${chartWidth - padX},${baseline}` : "";

  return (
    <section className="panel dashboard-trend-panel">
      <header className="panel-title">
        <div>
          <h2>近 7 日新增工作</h2>
          <span>工作量趨勢</span>
        </div>
        <button className="panel-text-button" type="button">更多資料</button>
      </header>
      <svg className="line-chart dashboard-line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = padTop + plotHeight * ratio;
          return <line key={ratio} x1={padX} x2={chartWidth - padX} y1={y} y2={y} />;
        })}
        <polygon points={area} />
        <polyline points={polyline} />
        {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="2.8" />)}
      </svg>
      <div className="trend-labels" style={{ gridTemplateColumns: `repeat(${Math.max(safeTrend.length, 1)}, minmax(0, 1fr))` }}>
        {safeTrend.map((item) => (
          <span key={item.date}><b>{item.count}</b>{item.date.slice(5)}</span>
        ))}
      </div>
    </section>
  );
}

function ModernDashboardPage({ dashboard, onReload, onDashboardChange, error, onNavigate, notify }) {
  const todos = dashboard?.openTodos || [];
  const followUps = dashboard?.followUps || [];
  const pendingCount = dashboard?.pendingCount ?? 0;
  const completedCount = dashboard?.completedCount ?? Math.max(0, (dashboard?.monthWorkCount || 0) - (dashboard?.pendingCount || 0));
  const completionTotal = completedCount + pendingCount;
  const completionRate = completionTotal ? Math.round((completedCount / completionTotal) * 100) : (dashboard?.completionRate ?? 0);
  const urgentTodoCount = todos.filter((todo) => normalizeTodoPriority(todo.priority) === "urgent").length;

  return (
    <>
      <header className="section-head">
        <div>
          <h1>儀表板</h1>
        </div>
      </header>
      <section className="dashboard-kpi-strip">
        <section className="dashboard-kpi-summary" aria-label="今日營運指標">
          <KpiSummaryItem
            label="今日待處理"
            value={pendingCount}
            unit="件"
            delta={dashboard?.deltas?.pending || "0"}
            deltaLabel="較昨日"
            detail={`需追蹤 ${pendingCount} 件`}
            tone={pendingCount > 0 ? "warn" : "good"}
            deltaImpact={parseDelta(dashboard?.deltas?.pending).direction === "down" ? "good" : "warn"}
          />
          <KpiSummaryItem
            label="本月工作"
            value={dashboard?.monthWorkCount ?? 0}
            unit="件"
            delta={dashboard?.deltas?.monthWork || "+0"}
            deltaLabel="較上月"
            detail="本月累計"
            tone="neutral"
            deltaImpact="neutral"
          />
          <KpiSummaryItem
            label="緊急任務"
            value={urgentTodoCount}
            unit="件"
            detail=""
            tone={urgentTodoCount > 0 ? "bad" : "good"}
          />
          <CompletionSummaryItem
            rate={completionRate}
            completed={completedCount}
            total={completionTotal}
            pending={pendingCount}
          />
        </section>
      </section>
      {error ? <div className="error-box">{error}</div> : null}

      <section className="dashboard-layout modern-dashboard-layout">
        <DashboardTodoPanel todos={todos} followUps={followUps} onReload={onReload} onNavigate={onNavigate} notify={notify} onDashboardChange={onDashboardChange} />
        <DashboardCalendarPanel dashboard={dashboard} notify={notify} />
      </section>
    </>
  );
}

export default function Page() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  function notify(nextToast) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), tone: "success", ...nextToast });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  async function loadDashboard() {
    setError("");
    try {
      setDashboard(await api("/api/dashboard"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    window.addEventListener("dashboard-data-changed", loadDashboard);
    return () => window.removeEventListener("dashboard-data-changed", loadDashboard);
  }, []);

  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (!requestedSection) return;
    const href = requestedSection === "kpi" ? "/boss-kpi" : getSectionHref(requestedSection);
    if (href !== "/") window.location.replace(href);
  }, []);

  function handleNavigate(sectionKey, item) {
    router.push(item?.href || (sectionKey === "kpi" ? "/boss-kpi" : getSectionHref(sectionKey)));
  }

  return (
    <AppShell activeSection="dashboard" title="儀表板" onNavigate={handleNavigate}>
      <DashboardToast toast={toast} />
      <ModernDashboardPage dashboard={dashboard} onReload={loadDashboard} onDashboardChange={setDashboard} error={error} onNavigate={handleNavigate} notify={notify} />
    </AppShell>
  );
}

