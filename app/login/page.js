"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "登入失敗");
      }

      const next = new URLSearchParams(window.location.search).get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err.message || "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submitLogin}>
        <div className="login-brand">HT</div>
        <div>
          <h1>太魯閣 IT 儀表板</h1>
          <p>請登入後繼續使用管理系統</p>
        </div>
        <label>
          帳號
          <input
            value={user}
            onChange={(event) => setUser(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button className="primary-action" type="submit" disabled={loading}>
          {loading ? "登入中" : "登入"}
        </button>
      </form>
    </main>
  );
}
