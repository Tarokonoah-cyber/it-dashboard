"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import { getSectionHref } from "./navigation";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MAX_TODO_TITLE_LENGTH = 120;
const TODO_PREVIEW_LIMIT = 5;
const TODO_COMPLETE_EXIT_MS = 600;
const CALENDAR_EVENT_TYPES = ["任務", "巡檢", "維護", "會議", "其他"];

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

function MiniSparkline({ values = [], tone = "neutral" }) {
  const safeValues = values.length ? values : [0, 0, 0, 0];
  const max = Math.max(1, ...safeValues);
  const width = 96;
  const height = 34;
  const points = safeValues.map((value, index) => {
    const x = safeValues.length <= 1 ? 0 : (index / (safeValues.length - 1)) * width;
    const y = height - Math.max(2, (value / max) * (height - 4));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg className={`kpi-sparkline ${tone}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} />
    </svg>
  );
}

function MetricCard({ label, value, unit = "", delta, deltaLabel = "", tone = "neutral", trendTone = "neutral", weight = "standard", bars = [], icon = "•", detail = "" }) {
  return (
    <section className={`metric-card dashboard-kpi-card ${tone} ${weight}`}>
      <div className="kpi-card-top">
        <div className="metric-icon" aria-hidden="true">{icon}</div>
        <span>{label}</span>
      </div>
      <div className="kpi-card-body">
        <div>
          <strong className="metric-value">{value}<small>{unit}</small></strong>
          {detail ? <small className="metric-detail">{detail}</small> : null}
        </div>
        <MiniSparkline values={bars} tone={trendTone} />
      </div>
      <div className="kpi-card-foot">
        <b className={`delta ${trendTone}`}>{delta}</b>
        {deltaLabel ? <span>{deltaLabel}</span> : null}
      </div>
    </section>
  );
}

function CompletionProgressCard({ rate, completed, total, pending }) {
  const normalized = Math.max(0, Math.min(100, Number(rate) || 0));
  const status = normalized < 50 ? "進度落後" : normalized < 80 ? "正常追蹤" : "接近完成";
  const tone = normalized < 50 ? "warn" : normalized < 80 ? "neutral" : "good";

  return (
    <section className={`metric-card dashboard-kpi-card completion-progress-card ${tone}`}>
      <div className="kpi-card-top">
        <div className="metric-icon" aria-hidden="true">%</div>
        <span>完成率</span>
      </div>
      <div className="completion-progress-main">
        <strong>{normalized}<small>%</small></strong>
        <b className={`completion-state ${tone}`}>{status}</b>
      </div>
      <div className="completion-progress-meta">
        <span>已完成 <b>{completed}</b> / {total} 件</span>
        <span>尚餘 <b>{pending}</b> 件</span>
      </div>
      <div className="completion-bar" aria-hidden="true">
        <span style={{ width: `${normalized}%` }} />
      </div>
    </section>
  );
}

function getTodoPriority(todo) {
  const raw = String(todo.priority || todo.level || todo.importance || "").trim();
  const title = String(todo.title || "").toLowerCase();
  if (/高|急|urgent|high|異常|逾期|ups|機房|電池|斷線|故障/.test(`${raw} ${title}`)) return { label: "高", tone: "high" };
  if (/中|medium|檢查|確認|盤點|維護/.test(`${raw} ${title}`)) return { label: "中", tone: "medium" };
  return { label: "一般", tone: "normal" };
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

function DashboardToast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`dashboard-toast ${toast.tone || "success"}`} role="status" aria-live="polite">
      <span aria-hidden="true" />
      <p>{toast.message}</p>
    </div>
  );
}

function DashboardTodoPanel({ todos, onReload, onNavigate, notify }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [processingTodoIds, setProcessingTodoIds] = useState(() => new Set());
  const [completedTodoIds, setCompletedTodoIds] = useState(() => new Set());
  const [fadingTodoIds, setFadingTodoIds] = useState(() => new Set());
  const todoInputRef = useRef(null);

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

  async function completeTodo(todo) {
    const id = todo?.id;
    if (!id || processingTodoIds.has(id) || completedTodoIds.has(id)) return;
    setError("");
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

  async function editTodo(row) {
    const next = window.prompt("修改待辦內容", row.title || "");
    if (!next || !next.trim()) return;
    if (next.trim().length > MAX_TODO_TITLE_LENGTH) {
      window.alert(`Todo title must be ${MAX_TODO_TITLE_LENGTH} characters or less`);
      return;
    }
    setError("");
    try {
      await api("/api/todos", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, title: next.trim() })
      });
      await onReload();
    } catch (err) {
      setError(err.message || "Todo 更新失敗");
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
          <span>待辦事項</span>
        </div>
        <button onClick={() => (isAdding ? cancelAddTodo() : setIsAdding(true))} disabled={saving}>
          {isAdding ? "取消" : "+ 新增"}
        </button>
      </header>
      {isAdding ? (
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
      <div className="dashboard-todo-list">
        {todos.length === 0 ? (
          <div className="empty">目前沒有待辦項目</div>
        ) : (
          todos.slice(0, TODO_PREVIEW_LIMIT).map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              isProcessing={processingTodoIds.has(todo.id)}
              isCompleted={completedTodoIds.has(todo.id)}
              isFading={fadingTodoIds.has(todo.id)}
              onComplete={() => completeTodo(todo)}
              onEdit={() => editTodo(todo)}
              onDelete={() => deleteTodo(todo.id)}
            />
          ))
        )}
      </div>
      {todos.length > TODO_PREVIEW_LIMIT ? (
        <button className="panel-link todo-view-all" type="button" onClick={() => onNavigate?.("work")}>
          查看全部 {todos.length} 筆 →
        </button>
      ) : null}
    </section>
  );
}

function TodoRow({ todo, isProcessing, isCompleted, isFading, onComplete, onEdit, onDelete }) {
  const priority = getTodoPriority(todo);
  const status = isProcessing ? "處理中..." : isCompleted ? "已完成" : todo.status || "未完成";
  const active = String(status).includes("進");
  const disabled = isProcessing || isCompleted || isFading;

  return (
    <article className={`dashboard-todo-row priority-${priority.tone} ${isProcessing ? "is-processing" : ""} ${isCompleted ? "is-completed" : ""} ${isFading ? "is-fading" : ""}`}>
      <button
        className={`circle todo-check ${isProcessing ? "is-loading" : ""} ${isCompleted ? "is-done" : ""}`}
        onClick={onComplete}
        disabled={disabled}
        aria-label={isProcessing ? "待辦處理中" : isCompleted ? "待辦已完成" : "完成待辦"}
      />
      <div className="todo-row-main">
        <strong>{todo.title || "未命名待辦"}</strong>
        <span>優先級：<b>{priority.label}</b></span>
      </div>
      <b className={isCompleted ? "status-done" : isProcessing ? "status-processing" : active ? "status-active" : "status-todo"}>{status}</b>
      <div className="row-actions">
        <button onClick={onEdit} disabled={disabled}>修改</button>
        <button onClick={onDelete} disabled={disabled}>刪除</button>
      </div>
    </article>
  );
}

function DashboardFocusPanel({ dashboard, onReload, onNavigate }) {
  const [syncing, setSyncing] = useState(false);
  const networkRooms = dashboard?.networkRooms || [];
  const today = new Date();
  const weekday = today.getDay();
  const phoneMap = {
    1: ["RV", "FB"],
    2: ["FB", "FO"],
    3: ["FO", "HK"],
    4: ["HK", "SPA"],
    5: ["Rec", "RV"]
  };
  const phoneTargets = phoneMap[weekday] || [];

  async function refresh() {
    setSyncing(true);
    try {
      await onReload();
    } finally {
      setSyncing(false);
    }
  }

  function scrollToCalendar() {
    document.querySelector(".dashboard-calendar-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="panel dashboard-focus-panel">
      <header className="panel-title">
        <div>
          <h2>今日工作中心</h2>
          <span>LINE、錄音與快速操作</span>
        </div>
        <button onClick={refresh}>{syncing ? "同步中" : "刷新"}</button>
      </header>

      <div className="focus-section network-section">
        <div className="focus-section-head">
          <b>今日串流</b>
          <span>{networkRooms.length ? `LINE Bot 已指派 ${networkRooms.length} 間` : "尚未指派"}</span>
        </div>
        {networkRooms.length ? (
          <>
            <p>LINE Bot 已指派以下測試房間</p>
            <div className="room-pill-row">
              {networkRooms.slice(0, 12).map((room) => (
                <span key={room.id || room.room_no} className={`room-pill ${room.status === "異常" ? "bad" : ""}`}>
                  {room.room_no}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="compact-empty">目前尚未收到房務 LINE 指派的網路測試房間。</div>
        )}
      </div>

      <div className="focus-section phone-section">
        <div>
          <b>電話錄音</b>
          <p>錄音服務正常運行中</p>
        </div>
        <div className="phone-pills">
          {phoneTargets.length ? phoneTargets.map((target) => <span key={target}>{target}</span>) : <span>-</span>}
        </div>
      </div>

      <div className="focus-section quick-actions-section">
        <b>快速操作</b>
        <div className="quick-action-grid">
          <button type="button" onClick={() => onNavigate?.("work")}>新增工作</button>
          <button type="button" onClick={() => onNavigate?.("work")}>查看待處理</button>
          <button type="button" onClick={scrollToCalendar}>新增行程</button>
        </div>
      </div>
    </section>
  );
}

function DashboardCalendarPanel({ notify }) {
  const router = useRouter();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const todayKey = getLocalDateKey(year, month, today);
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
  const [localEvents, setLocalEvents] = useState(() => ({
    [getLocalDateKey(year, month, 11)]: [{ id: "seed-11", title: "維護作業", type: "維護" }],
    [getLocalDateKey(year, month, 13)]: [{ id: "seed-13", title: "保險調查", type: "任務" }],
    [getLocalDateKey(year, month, 16)]: [{ id: "seed-16", title: "系統測試", type: "巡檢" }],
    [getLocalDateKey(year, month, 17)]: [{ id: "seed-17", title: "設備檢測", type: "維護" }]
  }));
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = localEvents[selectedDate] || [];

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
          <h2>行事曆 <small>Events</small></h2>
          <b>{year} / {String(month + 1).padStart(2, "0")}</b>
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
          <button className="calendar-add-main" type="button" onClick={() => openEventModal(selectedDate)}>
            + 新增行程
          </button>
          <button aria-label="上一月">‹</button>
          <button>今日</button>
          <button aria-label="下一月">›</button>
        </div>
      </header>
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
                <span className={day === today ? "today-dot" : ""}>{String(day).padStart(2, "0")}</span>
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
          <span>人員</span>
          <span>標題</span>
          <span>類型</span>
          <span>狀態</span>
        </div>
        {works.length ? works.slice(0, 4).map((work) => (
          <div className="work-row" key={work.id}>
            <span>{work.id || "-"}</span>
            <span title={formatDate(work.date || work.created_at)}>{formatRelativeDate(work.date || work.created_at)}</span>
            <span>{work.staff || work.owner || "-"}</span>
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
  const safeTrend = trend?.length ? trend : [];
  const max = Math.max(1, ...safeTrend.map((item) => item.count));
  const chartWidth = 700;
  const chartHeight = 154;
  const padX = 18;
  const padTop = 18;
  const padBottom = 24;
  const plotHeight = chartHeight - padTop - padBottom;
  const points = safeTrend.map((item, index) => {
    const x = safeTrend.length <= 1 ? padX : padX + (index / (safeTrend.length - 1)) * (chartWidth - padX * 2);
    const y = padTop + plotHeight - (item.count / max) * plotHeight;
    return { ...item, x, y };
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
      <div className="trend-labels">
        {safeTrend.map((item) => (
          <span key={item.date}><b>{item.count}</b>{item.date.slice(5)}</span>
        ))}
      </div>
    </section>
  );
}

function ModernDashboardPage({ dashboard, onReload, error, onNavigate, notify }) {
  const trendBars = (dashboard?.workTrend || []).map((item) => item.count);
  const todos = dashboard?.openTodos || [];
  const works = dashboard?.recentWorks || [];
  const completionRate = dashboard?.completionRate ?? 0;
  const completedCount = dashboard?.completedCount ?? Math.max(0, (dashboard?.monthWorkCount || 0) - (dashboard?.pendingCount || 0));
  const totalCount = dashboard?.monthWorkCount ?? 0;
  const abnormalCount = dashboard?.abnormalCount ?? dashboard?.networkSummary?.abnormal ?? 0;

  return (
    <>
      <section className="dashboard-kpi-strip">
        <section className="metrics-grid modern-metrics-grid" aria-label="今日營運指標">
          <MetricCard
            icon="✓"
            label="今日待處理"
            value={dashboard?.pendingCount ?? 0}
            unit="件"
            delta={dashboard?.deltas?.pending || "0"}
            deltaLabel="較昨日"
            detail="需追蹤"
            tone={(dashboard?.pendingCount || 0) > 0 ? "warn" : "good"}
            trendTone="good"
            weight="primary"
            bars={trendBars}
          />
          <MetricCard
            icon="□"
            label="本月工作"
            value={dashboard?.monthWorkCount ?? 0}
            unit="件"
            delta={dashboard?.deltas?.monthWork || "+0"}
            deltaLabel="較上月"
            detail="本月累計"
            tone="neutral"
            trendTone="neutral"
            weight="secondary"
            bars={trendBars}
          />
          <MetricCard
            icon="!"
            label="異常單"
            value={abnormalCount}
            unit="件"
            delta={abnormalCount ? `+${abnormalCount}` : "0"}
            deltaLabel="需處理"
            detail="異常 / 逾期"
            tone={abnormalCount > 0 ? "bad" : "good"}
            trendTone={abnormalCount > 0 ? "bad" : "good"}
            weight="primary"
            bars={trendBars}
          />
          <CompletionProgressCard
            rate={completionRate}
            completed={completedCount}
            total={totalCount}
            pending={dashboard?.pendingCount ?? 0}
          />
        </section>
      </section>
      {error ? <div className="error-box">{error}</div> : null}

      <section className="dashboard-layout modern-dashboard-layout">
        <DashboardTodoPanel todos={todos} onReload={onReload} onNavigate={onNavigate} notify={notify} />
        <DashboardCalendarPanel notify={notify} />
        <DashboardFocusPanel dashboard={dashboard} onReload={onReload} onNavigate={onNavigate} />
      </section>

      <section className="bottom-layout modern-bottom-layout">
        <DashboardWorkTable works={works} onNavigate={onNavigate} />
        <DashboardTrendPanel trend={dashboard?.workTrend || []} />
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

