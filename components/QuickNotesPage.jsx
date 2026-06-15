"use client";

import { useEffect, useRef, useState } from "react";

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

const MAX_QUICK_NOTE_LENGTH = 2000;

export default function QuickNotesPage() {
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const contentRef = useRef(null);
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
    if (!contentRef.current?.reportValidity()) return;
    const value = content.trim();
    if (!value) return;
    if (value.length > MAX_QUICK_NOTE_LENGTH) {
      setError(`備忘錄內容不可超過 ${MAX_QUICK_NOTE_LENGTH} 個字`);
      return;
    }
    try {
      setError("");
      await api("/api/quick-notes", { method: "POST", body: JSON.stringify({ content: value }) });
      setContent("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function editNote(note) {
    const next = window.prompt("修改備忘錄內容", note.content || "");
    if (!next || !next.trim()) return;
    if (next.trim().length > MAX_QUICK_NOTE_LENGTH) {
      setError(`備忘錄內容不可超過 ${MAX_QUICK_NOTE_LENGTH} 個字`);
      return;
    }
    try {
      setError("");
      await api("/api/quick-notes", { method: "PATCH", body: JSON.stringify({ id: note.id, content: next.trim() }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteNote(id) {
    if (!window.confirm("確定要刪除這則備忘錄？")) return;
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
    <section className="section-page quick-notes-page">
      <header className="section-head">
        <div>
          <h1>快速備忘錄</h1>
          <p>記錄臨時事項、交辦提醒與待確認資訊。</p>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="notes-composer">
        <textarea
          ref={contentRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={MAX_QUICK_NOTE_LENGTH}
          required
          placeholder="輸入備忘內容，例如交辦事項、需追蹤問題或會議提醒..."
        />
        <button onClick={addNote}>新增備忘</button>
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
              title="可拖曳調整排序"
            >
              <p>{note.content}</p>
              <div>
                <span className="drag-handle">拖曳排序</span>
                <button onClick={() => editNote(note)}>編輯</button>
                <button onClick={() => deleteNote(note.id)}>刪除</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
