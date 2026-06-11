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

function formatDateTime(value) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 16);
}

function MetricCard({ label, value, delta, tone = "neutral", bars = [] }) {
  const max = Math.max(1, ...bars);
  return (
    <section className="metric-card">
      <div className="metric-head">
        <span>{label}</span>
        <b className={`delta ${tone}`}>{delta}</b>
      </div>
      <div className="metric-value">{value}</div>
      <div className="sparkline" aria-hidden="true">
        {bars.map((bar, index) => (
          <i key={index} style={{ height: `${Math.max(8, (bar / max) * 42)}px` }} />
        ))}
      </div>
    </section>
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
        <span>{todos.length} 筆</span>
      </header>
      <div className="quick-input">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addTodo()}
          placeholder="新增待辦..."
        />
        <button onClick={addTodo} disabled={saving}>{saving ? "新增中" : "+ 新增"}</button>
      </div>
      <div className="todo-list">
        {todos.length === 0 ? (
          <div className="empty">目前沒有待辦項目</div>
        ) : (
          todos.map((todo) => (
            <article key={todo.id} className="todo-row">
              <button className="circle" onClick={() => completeTodo(todo.id)} aria-label="完成" />
              <strong>{todo.title}</strong>
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

function QuickNotesPanel() {
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [draggingId, setDraggingId] = useState("");

  async function loadNotes() {
    setStatus("讀取中...");
    try {
      const rows = await api("/api/quick-notes");
      setNotes(rows);
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function addNote() {
    const value = content.trim();
    if (!value) return;
    const row = await api("/api/quick-notes", {
      method: "POST",
      body: JSON.stringify({ content: value })
    });
    setContent("");
    setNotes((current) => [...current, row]);
  }

  async function editNote(row) {
    const next = window.prompt("修改備忘錄", row.content || "");
    if (!next || !next.trim()) return;
    const updated = await api("/api/quick-notes", {
      method: "PATCH",
      body: JSON.stringify({ id: row.id, content: next.trim() })
    });
    setNotes((current) => current.map((item) => (item.id === row.id ? updated : item)));
  }

  async function deleteNote(id) {
    if (!window.confirm("確定刪除這張備忘錄？")) return;
    await api(`/api/quick-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setNotes((current) => current.filter((item) => item.id !== id));
  }

  async function persistOrder(nextRows) {
    setNotes(nextRows);
    await api("/api/quick-notes/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: nextRows.map((row) => row.id) })
    });
  }

  function onDrop(targetId) {
    if (!draggingId || draggingId === targetId) return;
    const current = [...notes];
    const from = current.findIndex((row) => row.id === draggingId);
    const to = current.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    setDraggingId("");
    persistOrder(current);
  }

  return (
    <section className="panel notes-panel">
      <header className="panel-title">
        <h2>快速備忘錄</h2>
        <span>{notes.length} 筆</span>
      </header>
      <div className="note-input">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="臨時事項、待確認、小提醒..."
        />
        <button onClick={addNote}>+ 新增備忘</button>
      </div>
      {status ? <p className="inline-status">{status}</p> : null}
      <div className="note-list">
        {notes.map((note) => (
          <article
            key={note.id}
            draggable
            onDragStart={() => setDraggingId(note.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(note.id)}
            className={`note-card ${draggingId === note.id ? "dragging" : ""}`}
          >
            <p>{note.content}</p>
            <div>
              <button onClick={() => editNote(note)}>修改</button>
              <button onClick={() => deleteNote(note.id)}>刪除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TrendPanel({ trend }) {
  const max = Math.max(1, ...trend.map((item) => item.count));
  return (
    <section className="panel trend-panel">
      <header className="panel-title">
        <h2>近 7 日新增工作</h2>
        <span>Trend</span>
      </header>
      <div className="trend-chart">
        {trend.map((item) => (
          <div key={item.date} className="trend-col">
            <i style={{ height: `${Math.max(8, (item.count / max) * 130)}px` }} />
            <b>{item.count}</b>
            <span>{item.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OldLinks() {
  const links = [
    ["送交單據紀錄", "documents"],
    ["通訊錄", "contacts"],
    ["設備清單", "assets"],
    ["合約總覽", "contracts"],
    ["密碼管理", "passwords"],
    ["AnyDesk List", "anydesk"],
    ["SOP 文件", "sop"]
  ];

  return (
    <nav className="old-links">
      {links.map(([label, section]) => (
        <a
          key={section}
          href={OLD_APP_URL ? `${OLD_APP_URL}#${section}` : "#"}
          target="_blank"
          rel="noreferrer"
        >
          {label}
        </a>
      ))}
    </nav>
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

  const bars = useMemo(() => {
    const trend = dashboard?.workTrend || [];
    return trend.map((item) => item.count);
  }, [dashboard]);

  const todos = dashboard?.openTodos || [];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div>IT</div>
          <section>
            <h1>資訊室智慧平台</h1>
            <p>Operations Control Center</p>
          </section>
        </div>
        <a className="active-link" href="#">儀表板</a>
        <OldLinks />
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>儀表板</h1>
            <p>Vercel 版入口，先接 Supabase 快速資料。</p>
          </div>
          <button onClick={loadDashboard}>刷新</button>
        </header>

        {error ? <div className="error-box">{error}</div> : null}

        <section className="metrics-grid">
          <MetricCard label="今日工作" value={dashboard?.todayWorkCount ?? "..."} delta="即時" bars={bars} />
          <MetricCard label="本月工作" value={dashboard?.monthWorkCount ?? "..."} delta="+月" bars={bars} />
          <MetricCard label="待處理" value={dashboard?.pendingCount ?? "..."} delta="待" tone="bad" bars={bars} />
          <MetricCard label="完成率" value={`${dashboard?.completionRate ?? 0}%`} delta="OK" tone="good" bars={bars} />
        </section>

        <section className="main-grid">
          <TodoPanel todos={todos} onReload={loadDashboard} />
          <QuickNotesPanel />
        </section>

        <section className="bottom-grid">
          <section className="panel">
            <header className="panel-title">
              <h2>最近工作紀錄</h2>
              <span>Top 10</span>
            </header>
            <div className="work-list">
              {(dashboard?.recentWorks || []).map((work) => (
                <article key={work.id}>
                  <b>{work.title || work.description || "未命名工作"}</b>
                  <span>{work.staff || "-"} · {formatDateTime(work.date || work.updated_at)}</span>
                  <em>{work.status || "未開始"}</em>
                </article>
              ))}
            </div>
          </section>
          <TrendPanel trend={dashboard?.workTrend || []} />
        </section>
      </section>
    </main>
  );
}
