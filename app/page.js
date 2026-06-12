"use client";

import { useEffect, useMemo, useState } from "react";

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

const DATA_SECTIONS = {
  documents: { title: "送交單據紀錄", source: "documents", hint: "原 Sheet：送交單據紀錄表" },
  contacts: { title: "通訊錄", source: "contacts", hint: "原 Sheet：通訊錄" },
  assets: { title: "設備清單", source: "assets", hint: "整合山上電腦、山下電腦、印表機、北YA、IPTV" },
  assets_mountain_pc: { title: "山上電腦", source: "assets_mountain_pc", hint: "設備清單：山上電腦" },
  assets_downhill_pc: { title: "山下電腦", source: "assets_downhill_pc", hint: "設備清單：山下電腦" },
  assets_printer: { title: "印表機", source: "assets_printer", hint: "設備清單：印表機" },
  assets_north_ya: { title: "北YA", source: "assets_north_ya", hint: "設備清單：北YA" },
  assets_iptv: { title: "IPTV", source: "assets_iptv", hint: "設備清單：IPTV" },
  contracts: { title: "合約總覽", source: "contracts", hint: "原 Sheet：contracts / mobile_contracts" },
  contracts_software: { title: "軟體合約", source: "contracts_software", hint: "合約總覽：軟體合約" },
  contracts_mobile: { title: "行動電話約期", source: "contracts_mobile", hint: "合約總覽：行動電話約期" },
  anydesk: { title: "AnyDesk List", source: "anydesk", hint: "原 Sheet：ANYDESK LIST" },
  sop: { title: "SOP 文件", source: "sop", hint: "原 Sheet：sop_documents" },
  sop_docs: { title: "SOP", source: "sop", hint: "SOP 文件：SOP", presetKeyword: "SOP" },
  soc_docs: { title: "SOC", source: "sop", hint: "SOP 文件：SOC", presetKeyword: "SOC" }
};

const RECORD_COLUMN_CONFIGS = {
  contacts: [
    { label: "單位", keys: ["單位"] },
    { label: "職稱", keys: ["職稱", "Position"] },
    { label: "姓名", keys: ["姓名", "Name"] },
    { label: "分機", keys: ["分機 Extension"] },
    { label: "辦公室", keys: ["辦公室專線 Office"] },
    { label: "中華電信 *55", keys: ["中華電信 *55"] },
    { label: "行動電話", keys: ["個人行動電話"] },
    { label: "Email", keys: ["E-mail address", "Email"] }
  ],
  documents: [
    { label: "日期", keys: ["日期"] },
    { label: "月份", keys: ["月份"] },
    { label: "單據格式", keys: ["單據格式"] },
    { label: "成本歸屬", keys: ["成本歸屬"] },
    { label: "項目說明", keys: ["項目說明"] },
    { label: "總金額", keys: ["總金額"] },
    { label: "備註", keys: ["備註"] },
    { label: "最後更新", keys: ["最後更新時間"] }
  ],
  anydesk: [
    { label: "設備名稱", keys: ["設備名稱"] },
    { label: "AnyDesk ID", keys: ["AnyDesk ID"] },
    { label: "密碼", keys: ["密碼"] },
    { label: "備註", keys: ["備註"] },
    { label: "最後確認", keys: ["最後確認時間"] }
  ],
  contracts: [
    { label: "編號", keys: ["id"] },
    { label: "合約名稱", keys: ["contract_name"] },
    { label: "廠商", keys: ["vendor"] },
    { label: "開始日", keys: ["start_date"] },
    { label: "到期日", keys: ["end_date"] },
    { label: "金額", keys: ["amount"] },
    { label: "負責人", keys: ["owner"] },
    { label: "狀態", keys: ["status"] }
  ],
  contracts_software: [
    { label: "編號", keys: ["id"] },
    { label: "合約名稱", keys: ["contract_name"] },
    { label: "廠商", keys: ["vendor"] },
    { label: "開始日", keys: ["start_date"] },
    { label: "到期日", keys: ["end_date"] },
    { label: "金額", keys: ["amount"] },
    { label: "負責人", keys: ["owner"] },
    { label: "狀態", keys: ["status"] }
  ],
  contracts_mobile: [
    { label: "編號", keys: ["id"] },
    { label: "門號", keys: ["phone_no", "phone", "mobile_no", "門號"] },
    { label: "使用者", keys: ["user", "owner", "使用者"] },
    { label: "部門", keys: ["department", "部門"] },
    { label: "電信商", keys: ["carrier", "vendor", "電信商"] },
    { label: "到期日", keys: ["end_date", "expire_date", "到期日"] },
    { label: "方案", keys: ["plan", "方案"] },
    { label: "備註", keys: ["note", "備註"] }
  ],
  sop: [
    { label: "SOP 編號", keys: ["sop_id"] },
    { label: "名稱", keys: ["sop_name"] },
    { label: "分類", keys: ["category"] },
    { label: "系統", keys: ["system_name"] },
    { label: "部門", keys: ["department"] },
    { label: "版本", keys: ["version"] },
    { label: "狀態", keys: ["status"] },
    { label: "負責人", keys: ["owner"] }
  ],
  assets_default: [
    { label: "資產類型", keys: ["資產類型"] },
    { label: "設備名稱", keys: ["設備名稱", "電腦名稱"] },
    { label: "部門", keys: ["部門"] },
    { label: "使用人", keys: ["使用人"] },
    { label: "IP位置", keys: ["IP位置"] },
    { label: "型號", keys: ["主機型號", "設備型號", "型號"] },
    { label: "狀態", keys: ["狀態", "盤點狀態"] },
    { label: "備註", keys: ["備註", "盤點備註"] }
  ]
};

["assets", "assets_mountain_pc", "assets_downhill_pc", "assets_printer", "assets_north_ya", "assets_iptv"].forEach((source) => {
  RECORD_COLUMN_CONFIGS[source] = RECORD_COLUMN_CONFIGS.assets_default;
});

const OPEN_STATUSES = new Set(["未完成", "待辦", "待處理", "處理中", "未開始", ""]);
const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const DOCUMENT_TYPES = ["零用金支付憑證", "支票請求單", "用印申請書", "借據", "採購單"];
const COST_CENTERS = ["MIS", "ACC", "FO", "FB", "EO", "REC", "HK", "SEC", "HR", "ENG", "RV", "SPA"];

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
  const [draggingId, setDraggingId] = useState("");

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

  async function moveNote(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const fromIndex = notes.findIndex((note) => note.id === fromId);
    const toIndex = notes.findIndex((note) => note.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...notes];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setNotes(next);
    try {
      await api("/api/quick-notes/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: next.map((note) => note.id) })
      });
    } catch (err) {
      setError(err.message);
      await load();
    }
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
            <article
              className={`quick-note-card ${draggingId === note.id ? "dragging" : ""}`}
              key={note.id}
              draggable
              onDragStart={(event) => {
                setDraggingId(note.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", note.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                moveNote(event.dataTransfer.getData("text/plain") || draggingId, note.id);
                setDraggingId("");
              }}
              onDragEnd={() => setDraggingId("")}
              title="拖拉可調整順序"
            >
              <p>{note.content}</p>
              <div>
                <span className="drag-handle">拖拉</span>
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

function getRecordField(data, column) {
  for (const key of column.keys || [column.label]) {
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return "";
}

function DataSection({ config }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(config.presetKeyword || "");
  const [error, setError] = useState("");
  const [department, setDepartment] = useState("全部");
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    date: "",
    month: "",
    document_type: DOCUMENT_TYPES[0],
    cost_center: COST_CENTERS[0],
    description: "",
    total_amount: "",
    note: ""
  });

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
    setQuery(config.presetKeyword || "");
    setDepartment("全部");
    load();
  }, [config.source, config.presetKeyword]);

  const departments = useMemo(() => {
    if (config.source !== "contacts") return [];
    const values = rows
      .map((row) => String(getRecordField(row.data, { keys: ["單位"] }) || "").trim())
      .filter(Boolean);
    return ["全部", ...Array.from(new Set(values))];
  }, [config.source, rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchDepartment = config.source !== "contacts" || department === "全部" || getRecordField(row.data, { keys: ["單位"] }) === department;
      const matchKeyword = !keyword || JSON.stringify(row.data || {}).toLowerCase().includes(keyword);
      return matchDepartment && matchKeyword;
    });
  }, [rows, query, department, config.source]);

  const columns = useMemo(() => {
    const configured = RECORD_COLUMN_CONFIGS[config.source];
    if (configured?.length) return configured;
    const seen = [];
    for (const row of filteredRows.slice(0, 50)) {
      Object.keys(row.data || {}).forEach((key) => {
        if (!seen.includes(key) && seen.length < 8) seen.push(key);
      });
    }
    return seen.map((key) => ({ label: key, keys: [key] }));
  }, [config.source, filteredRows]);

  async function submitDocument(event) {
    event.preventDefault();
    setSavingDocument(true);
    setError("");
    try {
      await api("/api/records", {
        method: "POST",
        body: JSON.stringify({ source: "documents", ...documentForm })
      });
      setShowDocumentForm(false);
      setDocumentForm({
        date: "",
        month: "",
        document_type: DOCUMENT_TYPES[0],
        cost_center: COST_CENTERS[0],
        description: "",
        total_amount: "",
        note: ""
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDocument(false);
    }
  }

  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.hint}。若目前是空的，請先執行 Sheet 匯入 Supabase。</p>
        </div>
        <div className="section-actions">
          {config.source === "documents" && <button className="primary-action" onClick={() => setShowDocumentForm(true)}>＋新增</button>}
          <button onClick={load}>刷新</button>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="records-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋這個分頁..." />
        <span>{loading ? "讀取中..." : `${filteredRows.length} 筆`}</span>
      </div>
      {departments.length ? (
        <div className="department-filters">
          {departments.map((item) => (
            <button
              key={item}
              type="button"
              className={department === item ? "active" : ""}
              onClick={() => setDepartment(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <div className="records-table">
        {loading ? (
          <div className="empty">讀取資料中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty">目前沒有資料。請先建立 sheet_records 並執行匯入。</div>
        ) : (
          <>
            <div className="record-row record-head">
              {columns.map((column) => <span key={column.label}>{column.label}</span>)}
            </div>
            {filteredRows.map((row) => (
              <div className="record-row" key={row.id || row.record_key}>
                {columns.map((column) => (
                  <RecordValue key={column.label} value={getRecordField(row.data, column)} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
      {showDocumentForm ? (
        <div className="modal-backdrop" onMouseDown={() => setShowDocumentForm(false)}>
          <form className="document-modal" onSubmit={submitDocument} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>新增送交單據</h2>
                <p>新增後會立即寫入 Supabase 並刷新列表。</p>
              </div>
              <button type="button" onClick={() => setShowDocumentForm(false)}>×</button>
            </header>
            <div className="document-form-grid">
              <label>
                日期
                <input
                  type="date"
                  value={documentForm.date}
                  onChange={(event) => setDocumentForm((form) => ({ ...form, date: event.target.value, month: form.month || event.target.value.slice(0, 7) }))}
                  required
                />
              </label>
              <label>
                月份
                <input
                  type="month"
                  value={documentForm.month}
                  onChange={(event) => setDocumentForm((form) => ({ ...form, month: event.target.value }))}
                />
              </label>
              <label>
                單據格式
                <select value={documentForm.document_type} onChange={(event) => setDocumentForm((form) => ({ ...form, document_type: event.target.value }))}>
                  {DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                成本歸屬
                <select value={documentForm.cost_center} onChange={(event) => setDocumentForm((form) => ({ ...form, cost_center: event.target.value }))}>
                  {COST_CENTERS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="wide">
                項目說明
                <input
                  value={documentForm.description}
                  onChange={(event) => setDocumentForm((form) => ({ ...form, description: event.target.value }))}
                  placeholder="例如：設備採購 / 用印 / 支票請款"
                  required
                />
              </label>
              <label>
                總金額
                <input
                  inputMode="numeric"
                  value={documentForm.total_amount}
                  onChange={(event) => setDocumentForm((form) => ({ ...form, total_amount: event.target.value }))}
                  placeholder="例如：110000"
                />
              </label>
              <label className="wide">
                備註
                <textarea
                  value={documentForm.note}
                  onChange={(event) => setDocumentForm((form) => ({ ...form, note: event.target.value }))}
                  placeholder="補充說明"
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setShowDocumentForm(false)}>取消</button>
              <button className="primary-action" disabled={savingDocument} type="submit">{savingDocument ? "新增中..." : "新增"}</button>
            </footer>
          </form>
        </div>
      ) : null}
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
            <h2>{FLAT_SECTIONS.find((item) => item.key === activeSection)?.label || "儀表板"}</h2>
            <p>今日日期：{taipeiNowLabel()}</p>
          </div>
          <span className="online-dot">System Online</span>
        </header>
        {renderSection()}
      </section>
    </main>
  );
}
