"use client";

import { useEffect, useMemo, useState } from "react";

const OLD_APP_URL =
  process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbzJsb7rvaHg5PATAYjabulepQsFoY3BmeZPiH4fSsew4xchfX7gDkSF4Wj3kqvWwwoU/exec";

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {})
    },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "操作失敗");
  return data.data;
}

function dateKey(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDate(value) {
  const key = dateKey(value);
  return key || "-";
}

function taipeiNowLabel() {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).format(new Date());
}

function MetricCard({ label, value, delta, tone = "neutral", bars = [] }) {
  const max = Math.max(1, ...bars);
  return (
    <section className="metric-card">
      <div className="metric-head">
        <span>{label}</span>
        <b className={`delta ${tone}`}>{delta}</b>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="sparkline" aria-hidden="true">
        {bars.map((bar, index) => (
          <i key={index} style={{ height: `${Math.max(4, (bar / max) * 38)}px` }} />
        ))}
      </div>
    </section>
  );
}

function Sidebar() {
  const links = [
    ["📊", "儀表板", ""],
    ["🗒️", "快速備忘錄", ""],
    ["📝", "工作中心", ""],
    ["🧾", "送交單據紀錄", "documents"],
    ["📒", "通訊錄", "contacts"],
    ["🖥️", "設備清單", "assets"],
    ["📑", "合約總覽", "contracts"],
    ["🔐", "密碼管理", "passwords"],
    ["🛠️", "AnyDesk List", "anydesk"],
    ["📚", "SOP 文件", "sop"],
    ["🔔", "系統通知", "notifications"],
    ["⚙️", "設定", "settings"]
  ];

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">IT</div>
        <div className="brand-copy">
          <h1>資訊室智慧平台</h1>
          <p>Operations Control Center</p>
        </div>
        <button className="collapse-btn" aria-label="收合">‹</button>
      </div>
      <div className="nav-label">主選單</div>
      <nav className="side-nav">
        {links.map(([icon, label, section], index) => {
          const active = index === 0;
          const href = section ? `${OLD_APP_URL}#${section}` : "#";
          return (
            <a
              key={label}
              className={`nav-item ${active ? "active" : ""}`}
              href={href}
              target={section ? "_blank" : undefined}
              rel={section ? "noreferrer" : undefined}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <span>Vercel Web App</span>
        <span>Supabase Fast Dashboard</span>
      </div>
    </aside>
  );
}

function TodoPanel({ todos, onReload }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function addTodo() {
    const value = title.trim();
    if (!value) return;
    setSaving(true);
    try {
      await api("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: value })
      });
      setTitle("");
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  async function completeTodo(id) {
    await api("/api/todos", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "已完成" })
    });
    await onReload();
  }

  async function editTodo(row) {
    const next = window.prompt("修改待辦內容", row.title || "");
    if (!next || !next.trim()) return;
    await api("/api/todos", {
      method: "PATCH",
      body: JSON.stringify({ id: row.id, title: next.trim() })
    });
    await onReload();
  }

  async function deleteTodo(id) {
    if (!window.confirm("確定刪除這筆待辦？")) return;
    await api(`/api/todos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await onReload();
  }

  return (
    <section className="panel todo-panel">
      <header className="panel-title">
        <h2>Todo List</h2>
        <button onClick={addTodo} disabled={saving}>{saving ? "新增中" : "+ 新增"}</button>
      </header>
      <div className="todo-quick-add">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addTodo()}
          placeholder="新增待辦..."
        />
      </div>
      <div className="todo-list">
        {todos.length === 0 ? (
          <div className="empty">目前沒有待辦項目</div>
        ) : (
          todos.slice(0, 8).map((todo) => (
            <article key={todo.id} className="todo-row">
              <button className="circle" onClick={() => completeTodo(todo.id)} aria-label="完成" />
              <strong>{todo.title || "未命名待辦"}</strong>
              <div className="row-actions">
                <button onClick={() => editTodo(todo)}>修改</button>
                <button onClick={() => deleteTodo(todo.id)}>刪除</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function FocusPanel({ dashboard, onReload }) {
  const [syncing, setSyncing] = useState(false);
  const networkRooms = dashboard?.networkRooms || [];
  const networkSummary = dashboard?.networkSummary || { pending: 0, done: 0, abnormal: 0 };
  const today = new Date();
  const weekday = today.getDay();
  const phoneMap = {
    1: "RV & FB",
    2: "FB & FO",
    3: "FO & HK",
    4: "HK & SPA",
    5: "Rec & RV"
  };
  const phoneTarget = phoneMap[weekday] || "-";

  async function refresh() {
    setSyncing(true);
    try {
      await onReload();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="panel focus-panel">
      <header className="panel-title">
        <h2>今日重點</h2>
        <div className="panel-actions">
          <span>即時更新中</span>
          <button onClick={refresh}>{syncing ? "同步中" : "刷新"}</button>
        </div>
      </header>
      <div className="focus-card">
        <div className="focus-head">
          <b>今日串流</b>
          <span>待測試 0 筆 · 已完成 0 筆</span>
        </div>
        <div className="network-empty">今天尚未收到房務 LINE 指派的網路測試房間。</div>
      </div>
      <div className="network-live-card">
        <div className="network-live-head">
          <b>今日串流</b>
          <span>待測試 {networkSummary.pending || 0} 筆 · 已完成 {networkSummary.done || 0} 筆</span>
        </div>
        {networkRooms.length ? (
          <div className="network-room-strip">
            {networkRooms.map((room) => (
              <article key={room.id || room.room_no} className={`network-room-card ${room.status === "異常" ? "abnormal" : ""}`}>
                <strong>{room.room_no}</strong>
                <span>{room.status || "待測試"}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="network-empty">今天尚未收到房務 LINE 指派的網路測試房間。</div>
        )}
      </div>
      <div className="focus-bottom">
        <div className="mini-card phone-card">
          <div>
            <span>電話錄音</span>
            <small>{new Intl.DateTimeFormat("zh-TW", { weekday: "long" }).format(today)}</small>
          </div>
          <strong>{phoneTarget}</strong>
          <div className="pill-actions">
            <button className="done">已完成</button>
            <button>備註</button>
          </div>
        </div>
        <div className="mini-card">
          <div>
            <span>今日異動紀錄</span>
            <small>supabase-fast</small>
          </div>
          <div className="change-grid">
            <b><span>新增</span>{dashboard?.todayWorkCount || 0}</b>
            <b><span>更新</span>0</b>
            <b><span>完成</span>0</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarPanel() {
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
    11: ["佈線場刊"],
    13: ["捐血"],
    16: ["董事會"],
    17: ["螢幕驗收"]
  };

  return (
    <section className="panel calendar-panel">
      <header className="panel-title calendar-title">
        <div>
          <h2>行事曆 <small>Events</small></h2>
          <b>{year} / {String(month + 1).padStart(2, "0")}</b>
        </div>
        <div className="calendar-actions">
          <button>+</button>
          <button>‹</button>
          <button>今日</button>
          <button>›</button>
        </div>
      </header>
      <div className="calendar-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <div key={day} className="weekday">{day}</div>
        ))}
        {cells.map((day, index) => (
          <div key={`${day || "blank"}-${index}`} className="day-cell">
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

function WorkTable({ works }) {
  return (
    <section className="panel recent-panel">
      <header className="panel-title">
        <h2>最近工作紀錄</h2>
        <span>Top 10</span>
      </header>
      <div className="work-table">
        <div className="work-row head">
          <span>編號</span>
          <span>日期</span>
          <span>人員</span>
          <span>標題</span>
          <span>類型</span>
          <span>狀態</span>
        </div>
        {works.slice(0, 10).map((work) => (
          <div className="work-row" key={work.id}>
            <span>{work.id || "-"}</span>
            <span>{formatDate(work.date || work.created_at)}</span>
            <span>{work.staff || "-"}</span>
            <strong>{work.title || work.description || "未命名工作"}</strong>
            <span>{work.category || "待辦"}</span>
            <b>{work.status || "未開始"}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendPanel({ trend }) {
  const max = Math.max(1, ...trend.map((item) => item.count));
  const points = trend.map((item, index) => {
    const x = trend.length <= 1 ? 0 : (index / (trend.length - 1)) * 100;
    const y = 90 - (item.count / max) * 74;
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `0,94 ${polyline} 100,94` : "";

  return (
    <section className="panel trend-panel">
      <header className="panel-title">
        <h2>近 7 日新增工作</h2>
        <span>工作量趨勢</span>
      </header>
      <svg className="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} />)}
        <polygon points={area} />
        <polyline points={polyline} />
        {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="1.3" />)}
      </svg>
      <div className="trend-labels">
        {trend.map((item) => (
          <span key={item.date}><b>{item.count}</b>{item.date.slice(5)}</span>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
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

  const trendBars = useMemo(() => (dashboard?.workTrend || []).map((item) => item.count), [dashboard]);
  const todos = dashboard?.openTodos || [];
  const works = dashboard?.recentWorks || [];

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="main-area">
        <header className="app-header">
          <div>
            <h2>儀表板</h2>
            <p>今日日期：{taipeiNowLabel()}</p>
          </div>
          <span className="online-dot">System Online</span>
        </header>

        <section className="page-head">
          <h1>儀表板</h1>
          <p>保留今天最需要看的數字、待辦與最新紀錄，其他細節移到對應頁面。</p>
        </section>

        {error ? <div className="error-box">{error}</div> : null}

        <section className="metrics-grid">
          <MetricCard label="今日工作" value={dashboard?.todayWorkCount ?? 0} delta="▼ -3" bars={trendBars} />
          <MetricCard label="本月工作" value={dashboard?.monthWorkCount ?? 0} delta="▲ +13" bars={trendBars} />
          <MetricCard label="待處理" value={dashboard?.pendingCount ?? 0} delta="0" tone="bad" bars={trendBars} />
          <MetricCard label="完成率" value={`${dashboard?.completionRate ?? 0}%`} delta="OK" tone="good" bars={trendBars} />
        </section>

        <section className="dashboard-layout">
          <TodoPanel todos={todos} onReload={loadDashboard} />
          <FocusPanel dashboard={dashboard} onReload={loadDashboard} />
          <CalendarPanel />
        </section>

        <section className="bottom-layout">
          <WorkTable works={works} />
          <TrendPanel trend={dashboard?.workTrend || []} />
        </section>
      </section>
    </main>
  );
}
