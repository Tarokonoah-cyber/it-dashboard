"use client";

import { useState } from "react";
import LineReminderSettingsCard from "./LineReminderSettingsCard";

export default function SettingsPage() {
  const [form, setForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
    setTone("");
  }

  async function changePassword(event) {
    event.preventDefault();
    if (form.nextPassword !== form.confirmPassword) {
      setTone("error");
      setMessage("兩次輸入的新密碼不一致");
      return;
    }

    setSaving(true);
    setMessage("");
    setTone("");
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          nextPassword: form.nextPassword
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "密碼更新失敗");
      setForm((current) => ({ ...current, currentPassword: "", nextPassword: "", confirmPassword: "" }));
      setTone("success");
      setMessage(data.message || "密碼已更新");
    } catch (error) {
      setTone("error");
      setMessage(error.message || "密碼更新失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section-page settings-page">
      <header className="section-head">
        <div><h1>設定</h1></div>
      </header>

      <div className="settings-grid">
        <div className="mini-card"><b>正式介面</b><span>Vercel Dashboard</span></div>
        <div className="mini-card"><b>正式資料來源</b><span>Supabase</span></div>
        <div className="mini-card"><b>資料流程</b><span>單一 Supabase 寫入流程</span></div>
      </div>

      <section className="settings-security-card" aria-labelledby="change-password-title">
        <div className="settings-security-copy">
          <span>帳號安全</span>
          <h2 id="change-password-title">變更登入密碼</h2>
          <p>輸入目前密碼即可自行更新。新密碼只保存不可逆雜湊，不會保存明碼。</p>
        </div>
        <form className="settings-password-form" onSubmit={changePassword}>
          <label>
            目前密碼
            <input type="password" value={form.currentPassword} onChange={(event) => updateField("currentPassword", event.target.value)} autoComplete="current-password" required />
          </label>
          <div className="settings-password-row">
            <label>
              新密碼
              <input type="password" minLength={8} value={form.nextPassword} onChange={(event) => updateField("nextPassword", event.target.value)} autoComplete="new-password" required />
            </label>
            <label>
              再輸入一次
              <input type="password" minLength={8} value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} autoComplete="new-password" required />
            </label>
          </div>
          <small>新密碼至少 8 碼。</small>
          {message ? <div className={`settings-password-message ${tone}`} role="status">{message}</div> : null}
          <button className="primary-action" type="submit" disabled={saving}>{saving ? "更新中" : "更新密碼"}</button>
        </form>
      </section>

      <LineReminderSettingsCard />
    </section>
  );
}
