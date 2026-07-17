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
  return (
    <section className="settings-line-card" aria-labelledby="line-reminder-title">
      <div className="settings-line-copy">
        <span>自動提醒</span>
        <h2 id="line-reminder-title">LINE 平日工作摘要</h2>
        <p>每週一至週五 08:30 彙整重要工作、追蹤、行程、巡檢異常與 30 天內到期合約。</p>
      </div>
      <div className="settings-line-status">
        <div className="line-status-row">
          <span className={`line-status-dot ${status?.configured ? "connected" : ""}`} aria-hidden="true" />
          <div><strong>{loading ? "檢查中…" : status?.configured ? "LINE 已連線" : "LINE 尚未完成設定"}</strong><small>只推送到目前允許的 LINE 群組</small></div>
        </div>
        <dl>
          <div><dt>推播時間</dt><dd>週一至週五 08:30</dd></div>
          <div><dt>最近結果</dt><dd>{lastDelivery?.status === "sent" ? "發送成功" : lastDelivery?.status === "failed" ? "發送失敗" : lastDelivery?.status === "unavailable" ? "紀錄表尚未就緒" : "尚無推播"}</dd></div>
          <div><dt>最近時間</dt><dd>{timeLabel(lastDelivery?.sent_at || lastDelivery?.created_at)}</dd></div>
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
