"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import { getSectionHref } from "./navigation";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MAX_TODO_TITLE_LENGTH = 120;
const TODO_PREVIEW_LIMIT = 5;

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

function DashboardTodoPanel({ todos, onReload, onNavigate }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const todoInputRef = useRef(null);

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

  async function completeTodo(id) {
    setError("");
    try {
      await api("/api/todos", {
        method: "PATCH",
        body: JSON.stringify({ id, status: "已完成" })
      });
      await onReload();
    } catch (err) {
      setError(err.message || "Todo 更新失敗");
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
              onComplete={() => completeTodo(todo.id)}
              onEdit={() => editTodo(todo)}
              onDelete={() => deleteTodo(todo.id)}
            />
          ))
        )}
      </div>
      {todos.length > TODO_PREVIEW_LIMIT ? (
        <button className="panel-link" type="button" onClick={() => onNavigate?.("work")}>查看全部</button>
      ) : null}
    </section>
  );
}

function TodoRow({ todo, onComplete, onEdit, onDelete }) {
  const priority = getTodoPriority(todo);
  const status = todo.status || "未完成";
  const active = String(status).includes("進");

  return (
    <article className={`dashboard-todo-row priority-${priority.tone}`}>
      <button className="circle" onClick={onComplete} aria-label="完成待辦" />
      <div className="todo-row-main">
        <strong>{todo.title || "未命名待辦"}</strong>
        <span>優先級：<b>{priority.label}</b></span>
      </div>
      <b className={active ? "status-active" : "status-todo"}>{status}</b>
      <div className="row-actions">
        <button onClick={onEdit}>修改</button>
        <button onClick={onDelete}>刪除</button>
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

function DashboardCalendarPanel() {
  const router = useRouter();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const events = {
    11: ["維護作業"],
    13: ["保險調查"],
    16: ["系統測試"],
    17: ["設備檢測"]
  };

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
          <button aria-label="上一月">‹</button>
          <button>今日</button>
          <button aria-label="下一月">›</button>
        </div>
      </header>
      <div className="calendar-grid dashboard-calendar-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <div key={day} className="weekday">{day}</div>
        ))}
        {cells.map((day, index) => (
          <div key={`${day || "blank"}-${index}`} className="day-cell dashboard-day-cell">
            {day ? (
              <>
                <span className={day === today ? "today-dot" : ""}>{String(day).padStart(2, "0")}</span>
                {events[day]?.map((event) => <em key={event}>{event}</em>)}
              </>
            ) : null}
          </div>
        ))}
      </div>
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

function ModernDashboardPage({ dashboard, onReload, error, onNavigate }) {
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
        <DashboardTodoPanel todos={todos} onReload={onReload} onNavigate={onNavigate} />
        <DashboardCalendarPanel />
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
      <ModernDashboardPage dashboard={dashboard} onReload={loadDashboard} error={error} onNavigate={handleNavigate} />
    </AppShell>
  );
}

