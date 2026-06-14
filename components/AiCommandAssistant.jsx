"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_MESSAGE_LENGTH = 500;

const TEXT = {
  title: "IT \u5de5\u4f5c AI \u52a9\u7406",
  subtitle: "\u53ef\u5354\u52a9\u6574\u7406\u65e5\u8a8c\u3001\u7522\u751f KPI \u6458\u8981\u3001\u5206\u6790\u672a\u5b8c\u6210\u4e8b\u9805",
  welcome: "\u6211\u53ef\u4ee5\u5354\u52a9\u4f60\u6574\u7406\u76ee\u524d\u8cc7\u6599\uff0c\u4f8b\u5982\u7522\u751f\u4e3b\u7ba1\u6458\u8981\u3001\u7d71\u8a08\u672a\u5b8c\u6210\u4e8b\u9805\u3001\u5206\u6790\u5de5\u4f5c\u985e\u578b\uff0c\u6216\u5e6b\u4f60\u7522\u751f KPI \u5831\u544a\u6587\u5b57\u3002",
  placeholder: "\u8f38\u5165\u4f60\u60f3\u8981\u8655\u7406\u7684\u4efb\u52d9...",
  pending: "\u6574\u7406\u4e2d...",
  submit: "\u9001\u51fa",
  failed: "AI \u52a9\u7406\u66ab\u6642\u7121\u6cd5\u56de\u8986\u3002",
  go: "\u524d\u5f80\u9801\u9762",
  close: "\u95dc\u9589",
  minimize: "\u6700\u5c0f\u5316",
  restore: "\u9084\u539f"
};

const QUICK_PROMPTS = [
  "\u7522\u751f\u672c\u6708\u4e3b\u7ba1\u6458\u8981",
  "\u6574\u7406\u672a\u5b8c\u6210\u6e05\u55ae",
  "\u5206\u6790\u5de5\u4f5c\u985e\u578b\u5360\u6bd4",
  "\u7522\u751f KPI \u5831\u544a\u6587\u5b57",
  "\u65b0\u589e todo\uff1a\u6aa2\u67e5 UPS \u96fb\u6c60",
  "\u5efa\u7acb\u660e\u5929\u4e0b\u5348\u4e09\u9ede\u6aa2\u67e5\u6a5f\u623f\u7684\u65e5\u66c6\u8349\u7a3f"
];

const initialMessages = [
  {
    role: "assistant",
    text: TEXT.welcome
  }
];

export default function AiCommandAssistant({ open, minimized, onClose, onToggleMinimize }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(value) {
    if (!value || loading) return;
    setLoading(true);
    setError("");
    setAction(null);
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

    if (action.type === "create_todo") {
      return (
        <div className={`ai-chat-action-card ${action.status === "created" ? "success" : "warn"}`}>
          <b>{action.status === "created" ? "\u5df2\u5efa\u7acb Todo" : "\u7121\u6cd5\u5efa\u7acb Todo"}</b>
          <span>{action.title || "\u672a\u53d6\u5f97\u6a19\u984c"}</span>
        </div>
      );
    }

    if (action.type === "calendar_draft") {
      return (
        <div className="ai-chat-action-card">
          <b>\u65e5\u66c6\u8349\u7a3f</b>
          <span>\u6a19\u984c\uff1a{action.title || "-"}</span>
          <span>\u65e5\u671f\uff1a{action.dateText || "\u5f85\u78ba\u8a8d"}</span>
          <span>\u6642\u9593\uff1a{action.timeText || "\u5f85\u78ba\u8a8d"}</span>
          {action.note ? <span>\u5099\u8a3b\uff1a{action.note}</span> : null}
        </div>
      );
    }

    if (action.type === "analysis") {
      return (
        <div className="ai-chat-action-card">
          <b>{action.label || "\u5206\u6790\u7d50\u679c"}</b>
          <span>{action.status === "insufficient_data" ? "\u8cc7\u6599\u4e0d\u8db3" : "\u5df2\u7522\u751f\u8349\u7a3f"}</span>
        </div>
      );
    }

    return null;
  }

  if (!open) return null;

  if (minimized) {
    return (
      <section className="ai-chat-window minimized" aria-label={TEXT.title}>
        <button className="ai-chat-minimized-button" type="button" onClick={onToggleMinimize}>
          <span>{TEXT.title}</span>
          <b>{TEXT.restore}</b>
        </button>
        <button className="ai-chat-icon-button" type="button" onClick={onClose} aria-label={TEXT.close}>
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
          <span>{TEXT.subtitle}</span>
        </div>
        <div className="ai-chat-window-actions">
          <button className="ai-chat-icon-button" type="button" onClick={onToggleMinimize} aria-label={TEXT.minimize}>
            _
          </button>
          <button className="ai-chat-icon-button" type="button" onClick={onClose} aria-label={TEXT.close}>
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
      </div>

      <div className="ai-chat-quick-actions">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => sendQuickPrompt(prompt)} disabled={loading}>
            {prompt}
          </button>
        ))}
      </div>

      {error ? <div className="ai-chat-error">{error}</div> : null}

      {renderActionDetails()}

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
