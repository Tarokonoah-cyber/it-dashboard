"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_MESSAGE_LENGTH = 500;

const TEXT = {
  title: "AI \u6307\u4ee4\u52a9\u624b",
  subtitle: "\u8f38\u5165\u60f3\u524d\u5f80\u7684\u529f\u80fd\uff0c\u52a9\u624b\u6703\u5354\u52a9\u5224\u65b7\u5165\u53e3",
  placeholder: "\u8f38\u5165\u6307\u4ee4\uff0c\u4f8b\u5982\uff1a\u6211\u8981\u770b\u5de5\u4f5c\u4e2d\u5fc3\u3001\u5c71\u4e0a\u96fb\u8166\u6e05\u55ae\u3001SOP",
  pending: "\u5224\u65b7\u4e2d...",
  submit: "\u9001\u51fa",
  failed: "AI \u6307\u4ee4\u52a9\u624b\u66ab\u6642\u7121\u6cd5\u56de\u8986\u3002",
  go: "\u524d\u5f80\u9801\u9762"
};

const assistantStyles = {
  margin: "0 28px 14px"
};

const formStyles = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "stretch"
};

const textareaStyles = {
  width: "100%",
  minHeight: 70,
  resize: "vertical",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: 12,
  background: "rgba(5, 12, 24, 0.58)",
  color: "#f8fbff",
  padding: "12px 14px",
  lineHeight: 1.5,
  outline: "none"
};

const replyStyles = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderTop: "1px solid rgba(124, 160, 220, 0.14)",
  paddingTop: 12
};

export default function AiCommandAssistant() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const value = message.trim();
    if (!value || loading) return;
    setLoading(true);
    setError("");
    setReply("");
    setAction(null);
    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || TEXT.failed);
      setReply(data.reply || "");
      setAction(data.action || null);
    } catch (err) {
      setError(err.message || TEXT.failed);
    } finally {
      setLoading(false);
    }
  }

  function runAction() {
    if (action?.type !== "navigate" || !action.href) return;
    router.push(action.href);
  }

  return (
    <section className="panel" style={assistantStyles} aria-label={TEXT.title}>
      <header className="panel-title">
        <div>
          <h2>{TEXT.title}</h2>
          <span>{TEXT.subtitle}</span>
        </div>
      </header>
      <form onSubmit={submit} style={formStyles}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          required
          placeholder={TEXT.placeholder}
          style={textareaStyles}
        />
        <button type="submit" disabled={loading || !message.trim()}>
          {loading ? TEXT.pending : TEXT.submit}
        </button>
      </form>
      {error ? <div className="error-box" style={{ marginTop: 12 }}>{error}</div> : null}
      {reply ? (
        <div style={replyStyles}>
          <p style={{ margin: 0, color: "#dbeafe", lineHeight: 1.55 }}>{reply}</p>
          {action?.href ? (
            <button type="button" onClick={runAction}>
              {action.label || TEXT.go}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
