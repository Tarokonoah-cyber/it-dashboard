"use client";

import { useCallback, useEffect, useState } from "react";

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "LINE 提醒狀態讀取失敗");
  return payload.data;
}

function timeLabel(value) {
  if (!value) return "尚無紀錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚無紀錄";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function deliveryLabel(delivery) {
  if (!delivery) return "尚無紀錄";
  const outcome = delivery.status === "sent" ? "成功" : delivery.status === "failed" ? "失敗" : "處理中";
  const count = Number(delivery.item_counts?.total);
  const countLabel = Number.isFinite(count) ? ` · ${count} 件` : "";
  return `${outcome} · ${timeLabel(delivery.sent_at || delivery.created_at)}${countLabel}`;
}

export default function LineReminderSettingsCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api("/api/line/reminders"));
    } catch (error) {
      setTone("error");
      setMessage(error.message || "LINE 提醒狀態讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendTest() {
    setTesting(true);
    setMessage("");
    setTone("");
    try {
      const result = await api("/api/line/reminders", { method: "POST", body: "{}" });
      setTone("success");
      setMessage(result.message || "LINE 測試訊息已送出");
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error.message || "LINE 測試訊息發送失敗");
    } finally {
      setTesting(false);
    }
  }

  const lastDelivery = status?.lastDelivery;
  const deliveries = status?.deliveries || {};
  return (
    <section className="settings-line-card" aria-labelledby="line-reminder-title">
      <div className="settings-line-copy">
        <span>自動提醒</span>
        <h2 id="line-reminder-title">LINE 智慧通知</h2>
        <p>平日 08:30 工作摘要、08:00–18:00 新增重大事項即時提醒，15:00 追催仍未完成的重大事項。</p>
      </div>
      <div className="settings-line-status">
        <div className="line-status-row">
          <span className={`line-status-dot ${status?.configured ? "connected" : ""}`} aria-hidden="true" />
          <div><strong>{loading ? "檢查中…" : status?.configured ? "LINE 已連線" : "LINE 尚未完成設定"}</strong><small>只私訊到設定的個人 LINE 帳號</small></div>
        </div>
        <dl>
          <div><dt>早上摘要</dt><dd>{deliveryLabel(deliveries.daily_digest)}</dd></div>
          <div><dt>即時重大</dt><dd>{deliveryLabel(deliveries.critical_event)}</dd></div>
          <div><dt>下午追催</dt><dd>{deliveryLabel(deliveries.critical_follow_up)}</dd></div>
        </dl>
        {lastDelivery?.error_message ? <p className="line-last-error">{lastDelivery.error_message}</p> : null}
        {message ? <div className={`settings-password-message ${tone}`} role="status">{message}</div> : null}
        <button className="primary-action" type="button" onClick={sendTest} disabled={loading || testing || !status?.configured}>
          {testing ? "發送中…" : "發送測試訊息"}
        </button>
      </div>
    </section>
  );
}
