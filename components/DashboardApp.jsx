"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import { getSectionHref } from "./navigation";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MAX_TODO_TITLE_LENGTH = 120;
const TODO_COMPLETE_EXIT_MS = 600;
const FOLLOW_UP_STATUSES = ["等待回覆", "處理中", "待確認", "已完成"];
const CALENDAR_EVENT_TYPES = ["任務", "巡檢", "維護", "會議", "其他"];
const CALENDAR_EVENTS_STORAGE_KEY = "dashboard-calendar-events";

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

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || "").trim());
}

function parseDelta(value) {
  const numeric = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) {
    return { text: "0", direction: "flat", label: "持平" };
  }
  return {
    text: `${numeric > 0 ? "+" : "-"}${Math.abs(numeric)}`,
    direction: numeric > 0 ? "up" : "down",
    label: numeric > 0 ? "增加" : "減少"
  };
}

function KpiSummaryItem({ label, value, unit = "", delta, deltaLabel = "", detail = "", tone = "neutral", deltaImpact = "neutral" }) {
  const parsedDelta = parseDelta(delta);
  const deltaTone = parsedDelta.direction === "flat" ? "flat" : deltaImpact;

  return (
    <article className={`kpi-summary-item ${tone}`}>
      <div className="kpi-summary-label">{label}</div>
      <div className="kpi-summary-main">
        <strong>{value}<small>{unit}</small></strong>
      </div>
      <div className="kpi-summary-meta">
        {deltaLabel ? (
          <span className={`kpi-delta ${deltaTone}`}>
            {parsedDelta.label} {parsedDelta.text}
            <small>{deltaLabel}</small>
          </span>
        ) : null}
        {detail ? <span>{detail}</span> : null}
      </div>
    </article>
  );
}

function CompletionSummaryItem({ rate, completed, total, pending }) {
  const normalized = Math.max(0, Math.min(100, Number(rate) || 0));
  const remaining = Math.max(0, Number(pending) || 0);
  const status = normalized < 50 ? "進度落後" : normalized < 80 ? "持續追蹤" : "接近完成";
  const tone = normalized < 50 ? "warn" : normalized < 80 ? "neutral" : "good";

  return (
    <article className={`kpi-summary-item completion-summary ${tone}`}>
      <div className="kpi-summary-label">完成率</div>
      <div className="completion-summary-main">
        <div className="kpi-donut" style={{ "--progress": `${normalized}%` }} aria-hidden="true">
          <span>{normalized}%</span>
        </div>
        <div>
          <strong>{completed}<small> / {total} 件</small></strong>
          <div className="kpi-summary-meta">
            <span className={`kpi-delta ${tone}`}>{status}</span>
            <span>尚餘 {remaining} 件</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatWorkTitle(work) {
  const title = String(work.title || "").trim();
  const description = String(work.description || "").trim();
  if (/^\d+$/.test(title) && description) return description;
  return title || description || "未命名工作";
}

function formatRelativeDate(value) {
  const key = dateKey(value);
  if (!key) return "-";
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} 天前`;
  return key.slice(5).replace("-", "/");
}

function formatCalendarDate(dateKeyValue) {
  return dateKeyValue ? dateKeyValue.replaceAll("-", "/") : "";
}

function getLocalDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayKey() {
  const now = new Date();
  return getLocalDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function getMonthLabel(date) {
  return `${date.getMonth() + 1}月`;
}

function getTodayPhoneTargets(date = new Date()) {
  const phoneMap = {
    1: ["RV", "FB"],
    2: ["FB", "FO"],
    3: ["FO", "HK"],
    4: ["HK", "SPA"],
    5: ["Rec", "RV"]
  };
  return phoneMap[date.getDay()] || [];
}

function emptyCalendarEvents() {
  return {};
}

function removeSeedCalendarEvents(events) {
  if (!events || typeof events !== "object") return emptyCalendarEvents();
  return Object.entries(events).reduce((nextEvents, [key, value]) => {
    const cleanEvents = Array.isArray(value)
      ? value.filter((event) => !String(event?.id || "").startsWith("seed-"))
      : [];
    if (cleanEvents.length) nextEvents[key] = cleanEvents;
    return nextEvents;
  }, {});
}

function loadStoredCalendarEvents() {
  if (typeof window === "undefined") return emptyCalendarEvents();
  try {
    const stored = window.localStorage.getItem(CALENDAR_EVENTS_STORAGE_KEY);
    if (!stored) return emptyCalendarEvents();
    const parsed = JSON.parse(stored);
    return removeSeedCalendarEvents(parsed);
  } catch {
    return emptyCalendarEvents();
  }
}

function DashboardToast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`dashboard-toast ${toast.tone || "success"}`} role="status" aria-live="polite">
      <span aria-hidden="true" />
      <p>{toast.message}</p>
    </div>
  );
}

function DashboardTodoPanel({ todos, followUps, onReload, onNavigate, notify }) {
  const todayKey = getTodayKey();
  const [activeTab, setActiveTab] = useState("todos");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [editingTodoId, setEditingTodoId] = useState("");
  const [editTitle, setEditTitle] = useState("");
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
  const visibleTodos = (todos || []).slice(0, 6);
  const visibleFollowUps = (followUps || []).slice(0, 5);

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
    setSaving(true);
    setError("");
    try {
      await api("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: value })
      });
      setTitle("");
      await onReload();
      setIsAdding(false);
    } catch (err) {
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
    addTodoState(setProcessingTodoIds, id);
    try {
      await api("/api/todos", {
        method: "PATCH",
        body: JSON.stringify({ id, status: "已完成" })
      });
      removeTodoState(setProcessingTodoIds, id);
      addTodoState(setCompletedTodoIds, id);
      notify?.({ tone: "success", message: `已完成：${todo.title || "未命名待辦"}` });
      window.setTimeout(() => {
        addTodoState(setFadingTodoIds, id);
        window.setTimeout(async () => {
          try {
            await onReload();
          } finally {
            removeTodoState(setCompletedTodoIds, id);
            removeTodoState(setFadingTodoIds, id);
          }
        }, TODO_COMPLETE_EXIT_MS);
      }, TODO_COMPLETE_EXIT_MS);
    } catch (err) {
      removeTodoState(setProcessingTodoIds, id);
      removeTodoState(setCompletedTodoIds, id);
      removeTodoState(setFadingTodoIds, id);
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
    setError("");
  }

  function cancelEditTodo() {
    setEditingTodoId("");
    setEditTitle("");
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
    try {
      await api("/api/todos", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, title: nextTitle })
      });
      cancelEditTodo();
      await onReload();
    } catch (err) {
      setError(err.message || "Todo 更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTodo(id) {
    if (!window.confirm("確定要刪除這筆待辦？")) return;
    setError("");
    try {
      await api(`/api/todos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await onReload();
    } catch (err) {
      setError(err.message || "Todo 刪除失敗");
    }
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
          <b>{todos.length}</b>
        </button>
        <button
          type="button"
          className={activeTab === "follow-ups" ? "active" : ""}
          onClick={() => setActiveTab("follow-ups")}
        >
          <span>待追蹤</span>
          <b>{(followUps || []).length}</b>
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
            {todos.length === 0 ? (
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
                  onEditTitleChange={setEditTitle}
                  onComplete={() => openCompleteChoice(todo)}
                  onEdit={() => startEditTodo(todo)}
                  onCancelEdit={cancelEditTodo}
                  onSaveEdit={() => saveEditTodo(todo)}
                  onDelete={() => deleteTodo(todo.id)}
                  isSaving={saving}
                />
              ))
            )}
          </div>
          {todos.length > 0 ? (
            <button className="panel-link todo-view-all" type="button" onClick={() => onNavigate?.("work")}>
              查看全部 {todos.length} 筆 →
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
          {(followUps || []).length > 0 ? (
            <button className="panel-link todo-view-all" type="button" onClick={() => onNavigate?.("follow-ups")}>
              查看全部 {(followUps || []).length} 筆 →
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
  onEditTitleChange,
  onComplete,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isSaving
}) {
  const disabled = isProcessing || isCompleted || isFading;

  return (
    <article className={`dashboard-todo-row ${isProcessing ? "is-processing" : ""} ${isCompleted ? "is-completed" : ""} ${isFading ? "is-fading" : ""}`}>
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
              maxLength={MAX_TODO_TITLE_LENGTH}
              aria-label="修改待辦內容"
              autoFocus
            />
          </div>
        ) : (
          <strong>{todo.title || "未命名待辦"}</strong>
        )}
      </div>
      <div className="row-actions">
        {isEditing ? (
          <>
            <button onClick={onSaveEdit} disabled={isSaving || !editTitle.trim()} aria-label="儲存待辦">✓</button>
            <button onClick={onCancelEdit} disabled={isSaving} aria-label="取消修改">×</button>
            <button className="danger" onClick={onDelete} disabled={disabled} aria-label="刪除待辦">刪除</button>
          </>
        ) : (
          <button className="icon-action" onClick={onEdit} disabled={disabled || isSaving} aria-label="修改待辦內容" title="修改">
            ✎
          </button>
        )}
      </div>
    </article>
  );
}

function CalendarTodayTest({ networkRooms }) {
  const streamRooms = (networkRooms || [])
    .map((room) => String(room.room_no || room.room || "").trim())
    .filter(Boolean);
  const phoneTargets = getTodayPhoneTargets();

  return (
    <div className="calendar-today-test" aria-label="今日測試">
      <b>今日測試</b>
      <span>
        串流：{streamRooms.length ? streamRooms.join("、") : "今日尚未指派"}
      </span>
      <span>
        錄音：{phoneTargets.length ? phoneTargets.join("、") : "-"}
      </span>
    </div>
  );
}

function DashboardCalendarPanel({ dashboard, notify }) {
  const router = useRouter();
  const todayKey = getTodayKey();
  const networkRooms = dashboard?.networkRooms || [];
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const today = new Date().getDate();
  const isCurrentMonth = todayKey.startsWith(`${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    date: todayKey,
    time: "",
    type: CALENDAR_EVENT_TYPES[0],
    note: ""
  });
  const [localEvents, setLocalEvents] = useState(loadStoredCalendarEvents);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = localEvents[selectedDate] || [];

  useEffect(() => {
    try {
      window.localStorage.setItem(CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify(localEvents));
    } catch {
      // Calendar persistence is best-effort in the browser.
    }
  }, [localEvents]);

  function selectMonth(nextMonth) {
    setVisibleMonth(nextMonth);
    const nextMonthPrefix = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
    setSelectedDate(todayKey.startsWith(nextMonthPrefix) ? todayKey : getLocalDateKey(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  }

  function shiftMonth(offset) {
    selectMonth(new Date(year, month + offset, 1));
  }

  function jumpToToday() {
    const now = new Date();
    selectMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  function openEventModal(dateValue = selectedDate) {
    setSelectedDate(dateValue);
    setEventForm({
      title: "",
      date: dateValue,
      time: "",
      type: CALENDAR_EVENT_TYPES[0],
      note: ""
    });
    setIsEventModalOpen(true);
  }

  function closeEventModal() {
    setIsEventModalOpen(false);
  }

  function saveCalendarEvent(event) {
    event.preventDefault();
    const title = eventForm.title.trim();
    if (!title) return;
    const nextEvent = {
      id: `local-${Date.now()}`,
      title,
      time: eventForm.time,
      type: eventForm.type,
      note: eventForm.note.trim()
    };
    setLocalEvents((current) => ({
      ...current,
      [eventForm.date]: [...(current[eventForm.date] || []), nextEvent]
    }));
    setSelectedDate(eventForm.date);
    setIsEventModalOpen(false);
    notify?.({ tone: "success", message: `已新增到 ${formatCalendarDate(eventForm.date)}` });
  }

  return (
    <section className="panel dashboard-calendar-panel">
      <header className="panel-title calendar-title">
        <div>
          <h2>行事曆 <b>{getMonthLabel(visibleMonth)}</b> <small>Events</small></h2>
        </div>
        <div className="calendar-actions">
          <button
            type="button"
            className="sports-calendar-easter-egg"
            title="Sports Calendar"
            aria-label="Open Sports Calendar"
            onClick={() => router.push("/calendar")}
          >
            🏆
          </button>
          <button className="calendar-add-main" type="button" onClick={() => openEventModal(selectedDate)} aria-label="新增行程" title="新增行程">
            ＋
          </button>
          <button type="button" aria-label="上一月" onClick={() => shiftMonth(-1)}>‹</button>
          <button type="button" onClick={jumpToToday}>今日</button>
          <button type="button" aria-label="下一月" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </header>
      <CalendarTodayTest networkRooms={networkRooms} />
      <div className="calendar-grid dashboard-calendar-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <div key={day} className="weekday">{day}</div>
        ))}
        {cells.map((day, index) => {
          const cellDate = day ? getLocalDateKey(year, month, day) : "";
          const dayEvents = cellDate ? localEvents[cellDate] || [] : [];
          return (
            <div
              key={`${day || "blank"}-${index}`}
              className={`day-cell dashboard-day-cell ${cellDate === selectedDate ? "is-selected" : ""}`}
              onClick={() => day && setSelectedDate(cellDate)}
              onDoubleClick={() => day && openEventModal(cellDate)}
            >
              {day ? (
              <>
                <button
                  className="calendar-cell-add"
                  type="button"
                  aria-label={`新增到 ${formatCalendarDate(cellDate)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEventModal(cellDate);
                  }}
                >
                  +
                </button>
                <span className={isCurrentMonth && day === today ? "today-dot" : ""}>{String(day).padStart(2, "0")}</span>
                {dayEvents.map((event) => <em key={event.id}>{event.time ? `${event.time} ` : ""}{event.title}</em>)}
              </>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="calendar-day-detail">
        <div>
          <b>{formatCalendarDate(selectedDate)}</b>
          <span>{selectedEvents.length ? `${selectedEvents.length} 筆行程` : "目前沒有行程"}</span>
        </div>
        {selectedEvents.length ? (
          <ul>
            {selectedEvents.map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong>
                <span>{event.time || "全天"} · {event.type}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" onClick={() => openEventModal(selectedDate)}>+ 新增到此日期</button>
      </div>
      {isEventModalOpen ? (
        <div className="calendar-modal-backdrop" role="presentation" onMouseDown={closeEventModal}>
          <form className="calendar-modal" onSubmit={saveCalendarEvent} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h3>新增行程</h3>
                <span>{formatCalendarDate(eventForm.date)}</span>
              </div>
              <button type="button" aria-label="關閉新增行程" onClick={closeEventModal}>×</button>
            </header>
            <label>
              標題
              <input
                value={eventForm.title}
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="輸入行程標題"
                required
                autoFocus
              />
            </label>
            <div className="calendar-modal-grid">
              <label>
                日期
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
              </label>
              <label>
                時間
                <input
                  type="time"
                  value={eventForm.time}
                  onChange={(event) => setEventForm((current) => ({ ...current, time: event.target.value }))}
                />
              </label>
            </div>
            <label>
              類型
              <select value={eventForm.type} onChange={(event) => setEventForm((current) => ({ ...current, type: event.target.value }))}>
                {CALENDAR_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              備註
              <textarea
                value={eventForm.note}
                onChange={(event) => setEventForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="補充說明，可留空"
                rows={3}
              />
            </label>
            <footer>
              <button type="button" onClick={closeEventModal}>取消</button>
              <button className="primary-action" type="submit">儲存</button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
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

function ModernDashboardPage({ dashboard, onReload, error, onNavigate, notify }) {
  const todos = dashboard?.openTodos || [];
  const followUps = dashboard?.followUps || [];
  const works = dashboard?.recentWorks || [];
  const pendingCount = dashboard?.pendingCount ?? 0;
  const completedCount = dashboard?.completedCount ?? Math.max(0, (dashboard?.monthWorkCount || 0) - (dashboard?.pendingCount || 0));
  const completionTotal = completedCount + pendingCount;
  const completionRate = completionTotal ? Math.round((completedCount / completionTotal) * 100) : (dashboard?.completionRate ?? 0);
  const abnormalCount = dashboard?.abnormalCount ?? dashboard?.networkSummary?.abnormal ?? 0;
  const hasRecentWorkTrend = dashboard?.workTrend?.some((item) => Number(item.count) > 0);

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
            label="異常單"
            value={abnormalCount}
            unit="件"
            detail={abnormalCount > 0 ? `需處理 ${abnormalCount} 件` : "目前無異常"}
            tone={abnormalCount > 0 ? "bad" : "good"}
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
        <DashboardTodoPanel todos={todos} followUps={followUps} onReload={onReload} onNavigate={onNavigate} notify={notify} />
        <DashboardCalendarPanel dashboard={dashboard} notify={notify} />
      </section>

      <section className={`bottom-layout modern-bottom-layout ${hasRecentWorkTrend ? "" : "single-panel"}`}>
        <DashboardWorkTable works={works} onNavigate={onNavigate} />
        {hasRecentWorkTrend ? <DashboardTrendPanel trend={dashboard?.workTrend || []} /> : null}
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

  function handleNavigate(sectionKey) {
    router.push(sectionKey === "kpi" ? "/boss-kpi" : getSectionHref(sectionKey));
  }

  return (
    <AppShell activeSection="dashboard" title="儀表板" onNavigate={handleNavigate}>
      <DashboardToast toast={toast} />
      <ModernDashboardPage dashboard={dashboard} onReload={loadDashboard} error={error} onNavigate={handleNavigate} notify={notify} />
    </AppShell>
  );
}

