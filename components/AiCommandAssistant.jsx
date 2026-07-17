"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_MESSAGE_LENGTH = 500;

const TEXT = {
  title: "BOT",
  welcome: "\u6211\u53ef\u4ee5\u5354\u52a9\u4f60\u5efa\u7acb\u5f85\u8fa6\u3001\u6574\u7406\u672a\u5b8c\u6210\u6e05\u55ae\u3001\u5206\u6790\u5de5\u4f5c\u985e\u578b\u6216\u7522\u751f KPI \u5831\u544a\u8349\u7a3f\u3002",
  placeholder: "\u8f38\u5165\u4f60\u60f3\u8981\u8655\u7406\u7684\u4efb\u52d9...",
  pending: "\u6574\u7406\u4e2d...",
  submit: "\u9001\u51fa",
  failed: "AI \u52a9\u7406\u66ab\u6642\u7121\u6cd5\u56de\u8986\u3002",
  go: "\u524d\u5f80\u9801\u9762",
  close: "\u95dc\u9589",
  minimize: "\u6700\u5c0f\u5316",
  restore: "\u9084\u539f",
  quickActions: "\u5feb\u6377\u6307\u4ee4"
};

const QUICK_PROMPTS = [
  "\u7522\u751f\u672c\u6708\u4e3b\u7ba1\u6458\u8981",
  "\u6574\u7406\u672a\u5b8c\u6210\u6e05\u55ae",
  "\u5206\u6790\u5de5\u4f5c\u985e\u578b\u5360\u6bd4",
  "\u7522\u751f KPI \u5831\u544a\u6587\u5b57"
];

const initialMessages = [
  {
    role: "assistant",
    text: TEXT.welcome
  }
];

export default function AiCommandAssistant() {
  const router = useRouter();
  const messagesEndRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [action, setAction] = useState(null);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, action, error, open, minimized]);

  function openAssistant() {
    setOpen(true);
    setMinimized(false);
  }

  async function sendMessage(value) {
    if (!value || loading) return;
    setLoading(true);
    setError("");
    setAction(null);
    setSources([]);
    setQuickActionsOpen(false);
    setMessages((current) => [...current, { role: "user", text: value }]);
    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || TEXT.failed);
      setMessages((current) => [...current, { role: "assistant", text: data.reply || "" }]);
      setAction(data.action || null);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      if (data.action?.type === "create_todo" && data.action.status === "created") {
        window.dispatchEvent(new CustomEvent("dashboard-data-changed", {
          detail: {
            type: "todo-created",
            todo: data.action.todo,
            workLogCreated: Boolean(data.action.workLogId)
          }
        }));
      }
    } catch (err) {
      setError(err.message || TEXT.failed);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const value = message.trim();
    if (!value || loading) return;
    setMessage("");
    await sendMessage(value);
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function sendQuickPrompt(prompt) {
    if (loading) return;
    setMessage("");
    await sendMessage(prompt);
  }

  function runAction() {
    if (action?.type !== "navigate" || !action.href) return;
    router.push(action.href);
  }

  async function confirmAction() {
    if (!action?.token || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai-assistant/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: action.token })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || TEXT.failed);
      setMessages((current) => [...current, { role: "assistant", text: data.reply || "動作已完成。" }]);
      setAction(data.action || null);
      if (["create_todo", "create_follow_up", "create_calendar_event", "complete_work_item"].includes(data.action?.type)) {
        window.dispatchEvent(new CustomEvent("dashboard-data-changed", { detail: { type: data.action.type, action: data.action } }));
      }
    } catch (err) {
      setError(err.message || TEXT.failed);
    } finally {
      setLoading(false);
    }
  }

  function renderActionDetails() {
    if (!action) return null;

    if (action.type === "navigate" && action.href) {
      return (
        <div className="ai-chat-action">
          <button type="button" onClick={runAction}>
            {action.label || TEXT.go}
          </button>
        </div>
      );
    }

    if (action.status === "needs_confirmation" && action.token) {
      return (
        <div className="ai-chat-action-card confirm">
          <b>確認後才會執行</b>
          <span>{action.summary || action.title || "確認動作"}</span>
          <div className="ai-chat-confirm-actions">
            <button type="button" onClick={confirmAction} disabled={loading}>{loading ? "執行中" : "確認執行"}</button>
            <button type="button" onClick={() => setAction(null)} disabled={loading}>取消</button>
          </div>
        </div>
      );
    }

    if (action.type === "create_todo") {
      return action.status === "created" ? (
        <div className="ai-chat-action-card success">
          <b>\u5df2\u65b0\u589e\u5f85\u8fa6</b>
          <span>{action.title || "\u672a\u53d6\u5f97\u6a19\u984c"}</span>
        </div>
      ) : null;
    }

    if (action.type === "create_follow_up" || action.type === "create_calendar_event") {
      return action.status === "created" ? (
        <div className="ai-chat-action-card success">
          <b>{action.type === "create_follow_up" ? "已新增待追蹤" : "已新增行程"}</b>
          <span>{action.title || "未取得標題"}</span>
        </div>
      ) : null;
    }

    if (action.type === "calendar_unavailable") {
      return (
        <div className="ai-chat-action-card warn">
          <b>\u884c\u4e8b\u66c6\u5c1a\u672a\u63a5\u4e0a\u65b0\u589e\u529f\u80fd</b>
          <span>\u76ee\u524d\u5100\u8868\u677f\u884c\u4e8b\u66c6\u5c1a\u672a\u652f\u63f4\u76f4\u63a5\u65b0\u589e\u3002</span>
        </div>
      );
    }

    if (action.type === "complete_work_item") {
      if (action.status === "completed") {
        return (
          <div className="ai-chat-action-card success">
            <b>\u5df2\u6a19\u8a18\u5b8c\u6210</b>
            <span>{action.title || "\u672a\u53d6\u5f97\u6a19\u984c"}</span>
          </div>
        );
      }
      return action.status === "not_found" || action.status === "ambiguous" || action.status === "failed" ? (
        <div className="ai-chat-action-card warn">
          <b>\u5c1a\u672a\u6a19\u8a18\u5b8c\u6210</b>
          <span>\u8acb\u78ba\u8a8d\u5de5\u4f5c\u6a19\u984c\u662f\u552f\u4e00\u5339\u914d\u3002</span>
        </div>
      ) : null;
    }

    if (action.type === "analysis") return null;

    return null;
  }

  if (!open) {
    return (
      <button className="ai-bot-launcher" type="button" onClick={openAssistant} aria-label={TEXT.title}>
        {TEXT.title}
      </button>
    );
  }

  if (minimized) {
    return (
      <section className="ai-chat-window minimized" aria-label={TEXT.title}>
        <button className="ai-chat-minimized-button" type="button" onClick={() => setMinimized(false)}>
          <span>{TEXT.title}</span>
          <b>{TEXT.restore}</b>
        </button>
        <button className="ai-chat-icon-button" type="button" onClick={() => setOpen(false)} aria-label={TEXT.close}>
          x
        </button>
      </section>
    );
  }

  return (
    <section className="ai-chat-window" aria-label={TEXT.title}>
      <header className="ai-chat-header">
        <div>
          <h2>{TEXT.title}</h2>
        </div>
        <div className="ai-chat-window-actions">
          <button className="ai-chat-icon-button" type="button" onClick={() => setMinimized(true)} aria-label={TEXT.minimize}>
            _
          </button>
          <button className="ai-chat-icon-button" type="button" onClick={() => setOpen(false)} aria-label={TEXT.close}>
            x
          </button>
        </div>
      </header>

      <div className="ai-chat-messages" aria-live="polite">
        {messages.map((item, index) => (
          <article className={`ai-chat-message ${item.role}`} key={`${item.role}-${index}`}>
            {item.text}
          </article>
        ))}
        {loading ? <article className="ai-chat-message assistant muted">{TEXT.pending}</article> : null}
        <div ref={messagesEndRef} />
      </div>

      <div className={`ai-chat-quick-actions ${quickActionsOpen ? "open" : "collapsed"}`}>
        {quickActionsOpen ? (
          QUICK_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" onClick={() => sendQuickPrompt(prompt)} disabled={loading}>
              {prompt}
            </button>
          ))
        ) : (
          <button type="button" className="ai-chat-quick-toggle" onClick={() => setQuickActionsOpen(true)}>
            {TEXT.quickActions}
          </button>
        )}
      </div>

      {error ? <div className="ai-chat-error">{error}</div> : null}

      {renderActionDetails()}

      {sources.length ? (
        <div className="ai-chat-sources">
          <b>資料來源</b>
          {sources.slice(0, 5).map((source) => (
            <button key={`${source.source}-${source.id}`} type="button" onClick={() => router.push(source.href)}>
              <span>{source.category}</span>
              <strong>{source.title}</strong>
            </button>
          ))}
        </div>
      ) : null}

      <form className="ai-chat-form" onSubmit={submit}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          required
          placeholder={TEXT.placeholder}
        />
        <button type="submit" disabled={loading || !message.trim()}>
          {TEXT.submit}
        </button>
      </form>
    </section>
  );
}
