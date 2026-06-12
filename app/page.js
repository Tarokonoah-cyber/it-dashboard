"use client";

import { useEffect, useMemo, useState } from "react";

const SECTIONS = [
  { key: "dashboard", icon: "📊", label: "儀表板" },
  { key: "quick-notes", icon: "📝", label: "快速備忘錄" },
  { key: "work", icon: "🧾", label: "工作中心" },
  { key: "documents", icon: "🗂️", label: "送交單據紀錄" },
  { key: "contacts", icon: "📒", label: "通訊錄" },
  { key: "assets", icon: "🖥️", label: "設備清單" },
  { key: "contracts", icon: "📑", label: "合約總覽" },
  { key: "passwords", icon: "🔐", label: "密碼管理" },
  { key: "anydesk", icon: "🛠️", label: "AnyDesk List" },
  { key: "sop", icon: "📚", label: "SOP 文件" },
  { key: "settings", icon: "⚙️", label: "設定" }
];

const DATA_SECTIONS = {
  documents: { title: "送交單據紀錄", source: "documents", hint: "原 Sheet：送交單據紀錄表" },
  contacts: { title: "通訊錄", source: "contacts", hint: "原 Sheet：通訊錄" },
  assets: { title: "設備清單", source: "assets", hint: "整合山上電腦、山下電腦、印表機、北YA、IPTV" },
  contracts: { title: "合約總覽", source: "contracts", hint: "原 Sheet：contracts / mobile_contracts" },
  anydesk: { title: "AnyDesk List", source: "anydesk", hint: "原 Sheet：ANYDESK LIST" },
  sop: { title: "SOP 文件", source: "sop", hint: "原 Sheet：sop_documents" }
};

const OPEN_STATUSES = new Set(["未完成", "待辦", "待處理", "處理中", "未開始", ""]);
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

function taipeiNowLabel() {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).format(new Date());
}

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || "").trim());
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

function Sidebar({ activeSection, onNavigate, collapsed, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand-row">
        <div className="brand-mark">IT</div>
        {!collapsed && (
          <div className="brand-copy">
            <h1>資訊室智慧平台</h1>
            <p>Operations Control Center</p>
          </div>
        )}
        <button className="collapse-btn" aria-label="收合側邊欄" onClick={onToggle}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>
      {!collapsed && <div className="nav-label">主選單</div>}
      <nav className="side-nav">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item ${activeSection === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      {!collapsed && (
        <div className="sidebar-foot">
          <span>Vercel Web App</span>
          <span>Supabase Fast Dashboard</span>
        </div>
      )}
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
  const networkSummary = dashboard?.networkSummary || { pending: 0, done: 0 };
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
            <b><span>新增</span>{dashboard?.todayChangeSummary?.created || dashboard?.todayWorkCount || 0}</b>
            <b><span>更新</span>{dashboard?.todayChangeSummary?.updated || 0}</b>
            <b><span>完成</span>{dashboard?.todayChangeSummary?.completed || 0}</b>
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
            <span>{work.staff || work.owner || "-"}</span>
            <strong>{work.title || work.description || "未命名工作"}</strong>
            <span>{work.category || work.type || "待辦"}</span>
            <b className={isDoneStatus(work.status) ? "status-done" : "status-pending"}>{work.status || "未開始"}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendPanel({ trend }) {
  const safeTrend = trend?.length ? trend : [];
  const max = Math.max(1, ...safeTrend.map((item) => item.count));
  const chartWidth = 700;
  const chartHeight = 180;
  const padX = 18;
  const padTop = 18;
  const padBottom = 26;
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
    <section className="panel trend-panel">
      <header className="panel-title">
        <h2>近 7 日新增工作</h2>
        <span>工作量趨勢</span>
      </header>
      <svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = padTop + plotHeight * ratio;
          return <line key={ratio} x1={padX} x2={chartWidth - padX} y1={y} y2={y} />;
        })}
        <polygon points={area} />
        <polyline points={polyline} />
        {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.2" />)}
      </svg>
      <div className="trend-labels">
        {safeTrend.map((item) => (
          <span key={item.date}><b>{item.count}</b>{item.date.slice(5)}</span>
        ))}
      </div>
    </section>
  );
}

function QuickNotesPage() {
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setNotes(await api("/api/quick-notes"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addNote() {
    const value = content.trim();
    if (!value) return;
    await api("/api/quick-notes", { method: "POST", body: JSON.stringify({ content: value }) });
    setContent("");
    await load();
  }

  async function editNote(note) {
    const next = window.prompt("修改備忘錄", note.content || "");
    if (!next || !next.trim()) return;
    await api("/api/quick-notes", { method: "PATCH", body: JSON.stringify({ id: note.id, content: next.trim() }) });
    await load();
  }

  async function deleteNote(id) {
    if (!window.confirm("確定刪除這張備忘？")) return;
    await api(`/api/quick-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>快速備忘錄</h1>
          <p>輕量便利貼，資料儲存在 Supabase quick_notes。</p>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="notes-composer">
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="臨時事項、待確認、小提醒..." />
        <button onClick={addNote}>+ 新增備忘</button>
      </div>
      <div className="quick-notes-grid">
        {loading ? (
          <div className="empty">讀取備忘錄中...</div>
        ) : notes.length === 0 ? (
          <div className="empty">目前沒有備忘錄</div>
        ) : (
          notes.map((note) => (
            <article className="quick-note-card" key={note.id}>
              <p>{note.content}</p>
              <div>
                <button onClick={() => editNote(note)}>修改</button>
                <button onClick={() => deleteNote(note.id)}>刪除</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function WorkCenterPage({ dashboard, onReload }) {
  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>工作中心</h1>
          <p>Todo List 和最近工作紀錄已串接 Supabase。</p>
        </div>
        <button onClick={onReload}>刷新</button>
      </header>
      <div className="work-center-layout">
        <TodoPanel todos={dashboard?.openTodos || []} onReload={onReload} />
        <WorkTable works={dashboard?.recentWorks || []} />
      </div>
    </section>
  );
}

function RecordValue({ value }) {
  if (value === null || value === undefined || value === "") return <span className="muted">-</span>;
  if (typeof value === "object") return <span>{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

function DataSection({ config }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/records?source=${encodeURIComponent(config.source)}`);
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [config.source]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => JSON.stringify(row.data || {}).toLowerCase().includes(keyword));
  }, [rows, query]);

  const columns = useMemo(() => {
    const seen = [];
    for (const row of filteredRows.slice(0, 50)) {
      Object.keys(row.data || {}).forEach((key) => {
        if (!seen.includes(key) && seen.length < 8) seen.push(key);
      });
    }
    return seen;
  }, [filteredRows]);

  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.hint}。若目前是空的，請先執行 Sheet 匯入 Supabase。</p>
        </div>
        <button onClick={load}>刷新</button>
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="records-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋這個分頁..." />
        <span>{loading ? "讀取中..." : `${filteredRows.length} 筆`}</span>
      </div>
      <div className="records-table">
        {loading ? (
          <div className="empty">讀取資料中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty">目前沒有資料。請先建立 sheet_records 並執行匯入。</div>
        ) : (
          <>
            <div className="record-row record-head">
              {columns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {filteredRows.map((row) => (
              <div className="record-row" key={row.id || row.record_key}>
                {columns.map((column) => (
                  <RecordValue key={column} value={row.data?.[column]} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function PasswordsPage() {
  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>密碼管理</h1>
          <p>這個頁面先不搬明文密碼。建議下一步做加密欄位與更嚴格權限。</p>
        </div>
      </header>
      <div className="empty">
        為了避免把公司帳密直接暴露在 Web 前端，密碼資料不會和一般 Sheet 資料一起匯入公開表。
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>設定</h1>
          <p>目前新平台使用 Vercel + Supabase。LINE webhook endpoint：/api/line/webhook。</p>
        </div>
      </header>
      <div className="settings-grid">
        <div className="mini-card"><b>前端入口</b><span>Vercel Dashboard</span></div>
        <div className="mini-card"><b>資料庫</b><span>Supabase</span></div>
        <div className="mini-card"><b>舊系統</b><span>Apps Script 保留備援與匯入工具</span></div>
      </div>
    </section>
  );
}

function DashboardPage({ dashboard, onReload, error }) {
  const trendBars = (dashboard?.workTrend || []).map((item) => item.count);
  const todos = dashboard?.openTodos || [];
  const works = dashboard?.recentWorks || [];

  return (
    <>
      <section className="page-head">
        <h1>儀表板</h1>
        <p>保留今天最需要看的數字、待辦與最新紀錄，其他細節移到對應頁面。</p>
      </section>
      {error ? <div className="error-box">{error}</div> : null}
      <section className="metrics-grid">
        <MetricCard label="今日工作" value={dashboard?.todayWorkCount ?? 0} delta={dashboard?.deltas?.todayWork || "0"} bars={trendBars} />
        <MetricCard label="本月工作" value={dashboard?.monthWorkCount ?? 0} delta={dashboard?.deltas?.monthWork || "0"} bars={trendBars} />
        <MetricCard label="待處理" value={dashboard?.pendingCount ?? 0} delta={dashboard?.deltas?.pending || "0"} tone={(dashboard?.pendingCount || 0) > 0 ? "bad" : "good"} bars={trendBars} />
        <MetricCard label="完成率" value={`${dashboard?.completionRate ?? 0}%`} delta={dashboard?.deltas?.completionRate || "OK"} tone="good" bars={trendBars} />
      </section>
      <section className="dashboard-layout">
        <TodoPanel todos={todos} onReload={onReload} />
        <FocusPanel dashboard={dashboard} onReload={onReload} />
        <CalendarPanel />
      </section>
      <section className="bottom-layout">
        <WorkTable works={works} />
        <TrendPanel trend={dashboard?.workTrend || []} />
      </section>
    </>
  );
}

export default function Page() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
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

  function renderSection() {
    if (activeSection === "dashboard") return <DashboardPage dashboard={dashboard} onReload={loadDashboard} error={error} />;
    if (activeSection === "quick-notes") return <QuickNotesPage />;
    if (activeSection === "work") return <WorkCenterPage dashboard={dashboard} onReload={loadDashboard} />;
    if (activeSection === "passwords") return <PasswordsPage />;
    if (activeSection === "settings") return <SettingsPage />;
    const config = DATA_SECTIONS[activeSection];
    if (config) return <DataSection config={config} />;
    return <DashboardPage dashboard={dashboard} onReload={loadDashboard} error={error} />;
  }

  return (
    <main className={`app-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <section className="main-area">
        <header className="app-header">
          <div>
            <h2>{SECTIONS.find((item) => item.key === activeSection)?.label || "儀表板"}</h2>
            <p>今日日期：{taipeiNowLabel()}</p>
          </div>
          <span className="online-dot">System Online</span>
        </header>
        {renderSection()}
      </section>
    </main>
  );
}
