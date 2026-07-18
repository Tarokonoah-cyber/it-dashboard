"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const VIEW_TABS = [
  { key: "unread", label: "未讀" },
  { key: "active", label: "目前通知" },
  { key: "snoozed", label: "已延後" },
  { key: "all", label: "全部" }
];

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "通知中心暫時無法使用");
  return payload.data;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function snoozeUntil(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export default function NotificationsPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [view, setView] = useState("unread");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSnapshot(await api("/api/notifications"));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const rows = snapshot?.items || [];
    return rows.filter((item) => {
      if (category !== "all" && item.source_type !== category) return false;
      if (view === "unread") return !item.is_read && !item.is_snoozed;
      if (view === "active") return !item.is_snoozed;
      if (view === "snoozed") return item.is_snoozed;
      return true;
    });
  }, [category, snapshot, view]);

  async function changeState(action, item, extra = {}) {
    const key = item?.key || "all";
    setBusyKey(key);
    setError("");
    setMessage("");
    try {
      setSnapshot(await api("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action, key: item?.key, ...extra })
      }));
      setMessage(action === "snooze" ? "已延後提醒" : action === "read_all" ? "已將全部通知標為已讀" : "通知狀態已更新");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyKey("");
    }
  }

  async function pushLine(keys) {
    setBusyKey(keys?.[0] || "line-all");
    setError("");
    setMessage("");
    try {
      const result = await api("/api/notifications", {
        method: "POST",
        body: JSON.stringify(keys ? { keys } : {})
      });
      setSnapshot(result.snapshot);
      setMessage(`已推播 ${result.pushed} 則通知至 LINE`);
    } catch (pushError) {
      setError(pushError.message);
    } finally {
      setBusyKey("");
    }
  }

  const summary = snapshot?.summary || { total: 0, unread: 0, snoozed: 0, critical: 0, categories: {} };
  const lineReady = Boolean(snapshot?.line?.configured);

  return (
    <section className="section-page notification-center-page">
      <header className="notification-center-head">
        <div>
          <span>OPERATIONS INBOX</span>
          <h1>統一通知中心</h1>
          <p>集中查看逾期工作、合約到期、巡檢異常、待追蹤與週期任務。</p>
        </div>
        <div className="notification-head-actions">
          <button type="button" onClick={load} disabled={loading}>重新整理</button>
          <button type="button" onClick={() => changeState("read_all")} disabled={!summary.unread || busyKey === "all"}>全部已讀</button>
          <button className="primary-action" type="button" onClick={() => pushLine()} disabled={!lineReady || !summary.unread || Boolean(busyKey)}>
            {busyKey === "line-all" ? "推播中…" : "推播未讀至 LINE"}
          </button>
        </div>
      </header>

      <div className="notification-summary-grid" aria-label="通知摘要">
        <article className="is-unread"><span>未讀通知</span><strong>{summary.unread}</strong><small>需要優先確認</small></article>
        <article className="is-critical"><span>緊急事項</span><strong>{summary.critical}</strong><small>逾期或異常</small></article>
        <article><span>已延後</span><strong>{summary.snoozed}</strong><small>到期後重新出現</small></article>
        <article className={lineReady ? "is-connected" : ""}><span>LINE 推播</span><strong>{lineReady ? "已連線" : "未設定"}</strong><small>{lineReady ? "可私訊指定個人帳號" : "請至設定完成連線"}</small></article>
      </div>

      {error ? <div className="notification-feedback is-error" role="alert">{error}</div> : null}
      {message ? <div className="notification-feedback is-success" role="status">{message}</div> : null}

      <section className="notification-inbox">
        <header className="notification-toolbar">
          <nav aria-label="通知檢視">
            {VIEW_TABS.map((tab) => (
              <button key={tab.key} className={view === tab.key ? "active" : ""} type="button" onClick={() => setView(tab.key)}>
                {tab.label}{tab.key === "unread" ? ` ${summary.unread}` : tab.key === "snoozed" ? ` ${summary.snoozed}` : ""}
              </button>
            ))}
          </nav>
          <label>
            類型
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">全部類型</option>
              {(snapshot?.categories || []).map((item) => (
                <option key={item.key} value={item.key}>{item.label}（{summary.categories[item.key] || 0}）</option>
              ))}
            </select>
          </label>
        </header>

        <div className="notification-list">
          {loading ? <div className="notification-empty">正在彙整通知…</div> : null}
          {!loading && !visibleItems.length ? (
            <div className="notification-empty"><strong>這個檢視目前沒有通知</strong><span>完成或延後的項目會依狀態自動整理。</span></div>
          ) : null}
          {!loading && visibleItems.map((item) => (
            <article className={`notification-item severity-${item.severity} ${item.is_read ? "is-read" : "is-unread"}`} key={item.key}>
              <div className="notification-item-icon" aria-hidden="true">{item.icon}</div>
              <div className="notification-item-main">
                <header>
                  <div>
                    <span className="notification-category">{item.category_label}</span>
                    <span className={`notification-severity severity-${item.severity}`}>{item.severity === "critical" ? "緊急" : item.severity === "high" ? "重要" : "提醒"}</span>
                    {item.is_snoozed ? <span className="notification-snoozed">延後至 {formatDateTime(item.snoozed_until)}</span> : null}
                  </div>
                  {!item.is_read ? <i title="未讀" /> : null}
                </header>
                <h2>{item.title}</h2>
                <p>{item.description || "請開啟來源資料確認內容。"}</p>
                <footer>
                  <time>{item.due_date ? `日期 ${item.due_date}` : "持續追蹤"}</time>
                  {item.line_pushed_at ? <span>LINE {formatDateTime(item.line_pushed_at)}</span> : null}
                </footer>
              </div>
              <div className="notification-item-actions">
                <Link href={item.href}>查看來源</Link>
                <button type="button" disabled={busyKey === item.key} onClick={() => changeState(item.is_read ? "unread" : "read", item)}>
                  {item.is_read ? "標為未讀" : "設為已讀"}
                </button>
                <select
                  aria-label={`延後提醒：${item.title}`}
                  value=""
                  disabled={busyKey === item.key}
                  onChange={(event) => {
                    const days = Number(event.target.value);
                    if (days > 0) changeState("snooze", item, { snoozed_until: snoozeUntil(days) });
                    if (event.target.value === "unsnooze") changeState("unsnooze", item);
                  }}
                >
                  <option value="">延後提醒</option>
                  <option value="1">1 天後</option>
                  <option value="3">3 天後</option>
                  <option value="7">7 天後</option>
                  {item.is_snoozed ? <option value="unsnooze">取消延後</option> : null}
                </select>
                <button type="button" disabled={!lineReady || busyKey === item.key} onClick={() => pushLine([item.key])}>LINE 推播</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
