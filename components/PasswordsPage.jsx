"use client";

import { useEffect, useMemo, useState } from "react";

const SEARCH_KEYS = [
  "category",
  "system_name",
  "login_url",
  "username",
  "password_item",
  "notes",
  "bitwarden_item_name"
];

const FALLBACK_PASSWORD_ENTRIES = [
  {
    id: "sample-001",
    category: "SaaS",
    system_name: "範例管理後台",
    login_url: "https://example.com/admin",
    username: "sample-user",
    password_item: "Example Vault Item",
    notes: "範例資料；實際帳密請存放於 Bitwarden。",
    bitwarden_item_name: "Example Vault Item",
    bitwarden_item_id: ""
  },
  {
    id: "sample-002",
    category: "Network",
    system_name: "範例網路設備",
    login_url: "",
    username: "",
    password_item: "Network Vault Reference",
    notes: "僅示範索引用途，不包含內部 IP、URL 或帳密。",
    bitwarden_item_name: "Network Vault Reference",
    bitwarden_item_id: ""
  }
];

async function api(path) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "資料讀取失敗");
  return Array.isArray(data.data) ? data.data : [];
}

function displayValue(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeLoginUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function notifyBitwardenPending() {
  window.alert("尚未串接 Bitwarden 讀取；此頁不保存或顯示實際密碼。");
}

export default function PasswordsPage() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const rows = await api("/api/password-entries");
      if (rows.length) {
        setEntries(rows);
        return;
      }
      setEntries(FALLBACK_PASSWORD_ENTRIES);
      setNotice("目前沒有可顯示的密碼索引資料，以下為安全範例資料。");
    } catch {
      setEntries(FALLBACK_PASSWORD_ENTRIES);
      setNotice("密碼索引資料暫時無法讀取，以下為安全範例資料。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredEntries = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter((entry) =>
      SEARCH_KEYS.some((key) => String(entry[key] || "").toLowerCase().includes(keyword))
    );
  }, [entries, query]);

  async function copyUsername(entry) {
    const username = String(entry.username || "").trim();
    if (!username) return;
    await navigator.clipboard?.writeText(username);
  }

  function openLoginUrl(entry) {
    const url = normalizeLoginUrl(entry.login_url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openBitwarden() {
    window.open("https://vault.bitwarden.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <section className="section-page password-index-page">
      <header className="section-head">
        <div>
          <h1>密碼管理</h1>
        </div>
        <div className="section-actions">
          <button type="button" onClick={load}>重新整理</button>
        </div>
      </header>

      <div className="security-notice">
        此頁只保存系統入口、帳號索引與 Bitwarden 對應項目，不保存實際密碼。顯示密碼與複製密碼按鈕目前僅為預留介面。
      </div>

      {notice ? <div className="error-box">{notice}</div> : null}

      <div className="records-toolbar password-index-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋分類、系統名稱、登入網址、帳號、Bitwarden 項目或備註..."
        />
        <span>{loading ? "讀取中..." : `${filteredEntries.length.toLocaleString("en-US")} 筆`}</span>
      </div>

      {loading ? (
        <div className="empty">正在讀取密碼索引...</div>
      ) : entries.length === 0 ? (
        <div className="password-empty-state">
          <h2>尚未建立密碼索引</h2>
          <p>請先在 Supabase 建立 public.password_entries，並只匯入不含實際密碼的索引資料。</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="empty">找不到符合條件的密碼索引</div>
      ) : (
        <div className="password-index-table-wrap">
          <table className="password-index-table">
            <thead>
              <tr>
                <th>分類</th>
                <th>系統名稱</th>
                <th>登入網址</th>
                <th>帳號 / 密碼</th>
                <th>備註</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const username = displayValue(entry.username);
                const loginUrl = displayValue(entry.login_url);
                const vaultItem = displayValue(entry.bitwarden_item_name || entry.password_item, "");

                return (
                  <tr key={entry.id}>
                    <td>{displayValue(entry.category)}</td>
                    <td>
                      <strong>{displayValue(entry.system_name)}</strong>
                      {vaultItem ? <small>Bitwarden: {vaultItem}</small> : null}
                    </td>
                    <td>
                      {entry.login_url ? (
                        <button className="password-link-button" type="button" onClick={() => openLoginUrl(entry)}>
                          {loginUrl}
                        </button>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="password-credential-cell">
                        <div>
                          <span>帳號</span>
                          <strong>{username}</strong>
                        </div>
                        <div>
                          <span>密碼</span>
                          <strong aria-label="密碼已隱藏">••••••••</strong>
                        </div>
                        <div className="password-inline-actions">
                          <button type="button" onClick={notifyBitwardenPending}>顯示密碼</button>
                          <button type="button" onClick={notifyBitwardenPending}>複製密碼</button>
                        </div>
                      </div>
                    </td>
                    <td className="password-notes-cell">{displayValue(entry.notes)}</td>
                    <td>
                      <div className="password-actions">
                        <button type="button" onClick={() => copyUsername(entry)} disabled={!entry.username}>
                          複製帳號
                        </button>
                        <button type="button" onClick={() => openLoginUrl(entry)} disabled={!entry.login_url}>
                          開啟登入網址
                        </button>
                        <button type="button" onClick={openBitwarden}>
                          開啟 Bitwarden
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
