"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AiCommandAssistant from "./AiCommandAssistant";

const SECTIONS = [
  { key: "dashboard", icon: "📊", label: "儀表板" },
  { key: "quick-notes", icon: "📝", label: "快速備忘錄" },
  { key: "work", icon: "🧾", label: "工作中心" },
  { key: "documents", icon: "🗂️", label: "送交單據紀錄" },
  { key: "contacts", icon: "📒", label: "通訊錄" },
  {
    key: "assets",
    icon: "🖥️",
    label: "設備清單",
    children: [
      { key: "assets_mountain_pc", label: "山上電腦" },
      { key: "assets_downhill_pc", label: "山下電腦" },
      { key: "assets_printer", label: "印表機" },
      { key: "assets_north_ya", label: "北YA" },
      { key: "assets_iptv", label: "IPTV" }
    ]
  },
  {
    key: "contracts",
    icon: "📑",
    label: "合約總覽",
    children: [
      { key: "contracts_software", label: "軟體合約" },
      { key: "contracts_mobile", label: "行動電話約期" }
    ]
  },
  { key: "passwords", icon: "🔐", label: "密碼管理" },
  { key: "anydesk", icon: "🛠️", label: "AnyDesk List" },
  {
    key: "sop",
    icon: "📚",
    label: "SOP 文件",
    children: [
      { key: "sop_docs", label: "SOP" },
      { key: "soc_docs", label: "SOC" }
    ]
  },
  { key: "settings", icon: "⚙️", label: "設定" }
];

const FLAT_SECTIONS = SECTIONS.flatMap((item) => [item, ...(item.children || [])]);

const ASSET_ROUTE_MAP = {
  assets: "/assets",
  assets_mountain_pc: "/assets/mountain-pc",
  assets_downhill_pc: "/assets/downhill-pc",
  assets_printer: "/assets/printers",
  assets_north_ya: "/assets/north-ya",
  assets_iptv: "/assets/iptv"
};

const CONTRACT_ROUTE_MAP = {
  contracts: "/contracts",
  contracts_software: "/contracts/software",
  contracts_mobile: "/contracts/mobile"
};

const SOP_ROUTE_MAP = {
  sop: "/sop",
  sop_docs: "/sop/docs",
  soc_docs: "/sop/soc"
};

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MAX_TODO_TITLE_LENGTH = 120;

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

function MetricCard({ label, value, delta, tone = "neutral", bars = [], icon = "•", detail = "", progress = null }) {
  const max = Math.max(1, ...bars);
  const normalizedProgress = progress == null ? null : Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <section className={`metric-card ${tone}`}>
      <div className="metric-icon" aria-hidden="true">{icon}</div>
      <div className="metric-head">
        <span>{label}</span>
        <b className={`delta ${tone}`}>{delta}</b>
      </div>
      <strong className="metric-value">{value}</strong>
      {detail ? <small className="metric-detail">{detail}</small> : null}
      <div className="sparkline" aria-hidden="true">
        {bars.map((bar, index) => (
          <i key={index} style={{ height: `${Math.max(4, (bar / max) * 38)}px` }} />
        ))}
      </div>
      {normalizedProgress != null ? (
        <div className="metric-progress" aria-hidden="true">
          <span style={{ width: `${normalizedProgress}%` }} />
        </div>
      ) : null}
    </section>
  );
}

function Sidebar({ activeSection, onNavigate, collapsed, onToggle }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(["assets", "contracts", "sop"]));

  function isGroupActive(item) {
    return item.key === activeSection || item.children?.some((child) => child.key === activeSection);
  }

  function toggleGroup(item) {
    if (collapsed) {
      onNavigate(item.children?.[0]?.key || item.key);
      return;
    }
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      return next;
    });
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
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
      </div>
      <nav className="side-nav">
        {SECTIONS.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const expanded = openGroups.has(item.key);
          const groupActive = isGroupActive(item);
          return (
            <div className="nav-group" key={item.key}>
              <button
                type="button"
                className={`nav-item ${groupActive ? "active" : ""} ${hasChildren ? "has-children" : ""}`}
                onClick={() => (hasChildren ? toggleGroup(item) : onNavigate(item.key))}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && hasChildren && <span className={`nav-caret ${expanded ? "open" : ""}`}>›</span>}
              </button>
              {!collapsed && hasChildren && expanded && (
                <div className="nav-children">
                  {item.children.map((child) => (
                    <button
                      key={child.key}
                      type="button"
                      className={`nav-child ${activeSection === child.key ? "active" : ""}`}
                      onClick={() => onNavigate(child.key)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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

function DashboardTodoPanel({ todos, onReload, onNavigate }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
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
    if (next.trim().length > MAX_TODO_TITLE_LENGTH) {
      window.alert(`Todo title must be ${MAX_TODO_TITLE_LENGTH} characters or less`);
      return;
    }
    await api("/api/todos", {
      method: "PATCH",
      body: JSON.stringify({ id: row.id, title: next.trim() })
    });
    await onReload();
  }

  async function deleteTodo(id) {
    if (!window.confirm("確定要刪除這筆待辦？")) return;
    await api(`/api/todos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await onReload();
  }

  return (
    <section className="panel dashboard-todo-panel">
      <header className="panel-title">
        <div>
          <h2>Todo List</h2>
          <span>待辦事項</span>
        </div>
        <button onClick={addTodo} disabled={saving}>{saving ? "新增中" : "+ 新增"}</button>
      </header>
      <div className="todo-quick-add dashboard-todo-input">
        <input
          ref={todoInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addTodo()}
          maxLength={MAX_TODO_TITLE_LENGTH}
          required
          placeholder="快速新增待辦..."
        />
      </div>
      <div className="dashboard-todo-list">
        {todos.length === 0 ? (
          <div className="empty">目前沒有待辦項目</div>
        ) : (
          todos.slice(0, 5).map((todo) => (
            <article key={todo.id} className="dashboard-todo-row">
              <button className="circle" onClick={() => completeTodo(todo.id)} aria-label="完成待辦" />
              <strong>{todo.title || "未命名待辦"}</strong>
              <b className={String(todo.status || "").includes("進") ? "status-active" : "status-todo"}>
                {todo.status || "待辦"}
              </b>
              <div className="row-actions">
                <button onClick={() => editTodo(todo)}>修改</button>
                <button onClick={() => deleteTodo(todo.id)}>刪除</button>
              </div>
            </article>
          ))
        )}
      </div>
      <button className="panel-link" type="button" onClick={() => onNavigate?.("work")}>查看全部</button>
    </section>
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
            <span>{formatDate(work.date || work.created_at)}</span>
            <span>{work.staff || work.owner || "-"}</span>
            <strong>{work.title || work.description || "未命名工作"}</strong>
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

  return (
    <>
      <section className="page-head modern-page-head">
        <h1>儀表板</h1>
        <p>掌握今日工作重點與最新進度。</p>
      </section>
      {error ? <div className="error-box">{error}</div> : null}

      <section className="metrics-grid modern-metrics-grid">
        <MetricCard
          icon="▣"
          label="今日工作"
          value={dashboard?.todayWorkCount ?? 0}
          delta={dashboard?.deltas?.todayWork || "持平"}
          detail="較昨日"
          bars={trendBars}
        />
        <MetricCard
          icon="◫"
          label="本月工作"
          value={dashboard?.monthWorkCount ?? 0}
          delta={dashboard?.deltas?.monthWork || "+0"}
          detail="較上月"
          bars={trendBars}
        />
        <MetricCard
          icon="!"
          label="待處理"
          value={dashboard?.pendingCount ?? 0}
          delta={dashboard?.deltas?.pending || "0"}
          detail="需追蹤"
          tone={(dashboard?.pendingCount || 0) > 0 ? "bad" : "good"}
          bars={trendBars}
        />
        <MetricCard
          icon="%"
          label="完成率"
          value={`${completionRate}%`}
          delta={`${completedCount}/${totalCount}`}
          detail={`待完成 ${dashboard?.pendingCount ?? 0}`}
          tone={completionRate >= 80 ? "good" : "warn"}
          bars={trendBars}
          progress={completionRate}
        />
      </section>

      <section className="dashboard-layout modern-dashboard-layout">
        <DashboardTodoPanel todos={todos} onReload={onReload} onNavigate={onNavigate} />
        <DashboardFocusPanel dashboard={dashboard} onReload={onReload} onNavigate={onNavigate} />
        <DashboardCalendarPanel />
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
  const [activeSection, setActiveSection] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiAssistantMinimized, setAiAssistantMinimized] = useState(false);

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
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (!requestedSection) return;
    if (requestedSection === "quick-notes") {
      window.location.replace("/quick-notes");
      return;
    }
    if (requestedSection === "work") {
      window.location.replace("/work");
      return;
    }
    if (requestedSection === "documents") {
      window.location.replace("/documents");
      return;
    }
    if (requestedSection === "passwords") {
      window.location.replace("/passwords");
      return;
    }
    if (requestedSection === "contacts") {
      window.location.replace("/contacts");
      return;
    }
    if (requestedSection === "anydesk") {
      window.location.replace("/anydesk");
      return;
    }
    if (ASSET_ROUTE_MAP[requestedSection]) {
      window.location.replace(ASSET_ROUTE_MAP[requestedSection]);
      return;
    }
    if (CONTRACT_ROUTE_MAP[requestedSection]) {
      window.location.replace(CONTRACT_ROUTE_MAP[requestedSection]);
      return;
    }
    if (SOP_ROUTE_MAP[requestedSection]) {
      window.location.replace(SOP_ROUTE_MAP[requestedSection]);
      return;
    }
    if (requestedSection === "settings") {
      window.location.replace("/settings");
      return;
    }
    if (requestedSection === "boss-kpi") {
      window.location.replace("/boss-kpi");
      return;
    }
    if (requestedSection === "kpi") {
      window.location.replace("/boss-kpi");
      return;
    }
    if (FLAT_SECTIONS.some((item) => item.key === requestedSection)) {
      setActiveSection(requestedSection);
    }
  }, []);

  function handleNavigate(sectionKey) {
    if (sectionKey === "quick-notes") {
      router.push("/quick-notes");
      return;
    }
    if (sectionKey === "work") {
      router.push("/work");
      return;
    }
    if (sectionKey === "documents") {
      router.push("/documents");
      return;
    }
    if (sectionKey === "passwords") {
      router.push("/passwords");
      return;
    }
    if (sectionKey === "contacts") {
      router.push("/contacts");
      return;
    }
    if (sectionKey === "anydesk") {
      router.push("/anydesk");
      return;
    }
    if (ASSET_ROUTE_MAP[sectionKey]) {
      router.push(ASSET_ROUTE_MAP[sectionKey]);
      return;
    }
    if (CONTRACT_ROUTE_MAP[sectionKey]) {
      router.push(CONTRACT_ROUTE_MAP[sectionKey]);
      return;
    }
    if (SOP_ROUTE_MAP[sectionKey]) {
      router.push(SOP_ROUTE_MAP[sectionKey]);
      return;
    }
    if (sectionKey === "settings") {
      router.push("/settings");
      return;
    }
    if (sectionKey === "boss-kpi" || sectionKey === "kpi") {
      router.push("/boss-kpi");
      return;
    }
    setActiveSection(sectionKey);
  }

  function openAiAssistant() {
    setAiAssistantOpen(true);
    setAiAssistantMinimized(false);
  }

  return (
    <main className={`app-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <section className="main-area">
        <header className="app-header">
          <div className="app-header-title">
            <h2>{FLAT_SECTIONS.find((item) => item.key === activeSection)?.label || "儀表板"}</h2>
            <p>今日日期：{taipeiNowLabel()}</p>
          </div>
          <div className="app-header-actions">
            <button className="ai-assistant-trigger" type="button" onClick={openAiAssistant}>
              AI 助理
            </button>
            <span className="online-dot">System Online</span>
          </div>
        </header>
        <ModernDashboardPage dashboard={dashboard} onReload={loadDashboard} error={error} onNavigate={handleNavigate} />
      </section>
      <AiCommandAssistant
        open={aiAssistantOpen}
        minimized={aiAssistantMinimized}
        onClose={() => setAiAssistantOpen(false)}
        onToggleMinimize={() => setAiAssistantMinimized((value) => !value)}
      />
    </main>
  );
}

