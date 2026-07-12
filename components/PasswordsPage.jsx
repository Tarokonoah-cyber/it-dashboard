"use client";

import { useEffect, useMemo, useState } from "react";
import { useUnsavedChangesWarning } from "./dataEditMode";

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

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "資料讀取失敗");
  return data.data;
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
  const [draftEntries, setDraftEntries] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [fallbackMode, setFallbackMode] = useState(false);
  const hasUnsavedChanges = editMode && (fallbackMode ? draftEntries.length > 0 : JSON.stringify(entries) !== JSON.stringify(draftEntries));

  useUnsavedChangesWarning(hasUnsavedChanges);

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const rows = await api("/api/password-entries");
      const safeRows = Array.isArray(rows) ? rows : [];
      if (safeRows.length) {
        setEntries(safeRows);
        setFallbackMode(false);
        return;
      }
      setEntries(FALLBACK_PASSWORD_ENTRIES);
      setFallbackMode(true);
      setNotice("目前沒有可顯示的密碼索引資料，以下為安全範例資料。");
    } catch {
      setEntries(FALLBACK_PASSWORD_ENTRIES);
      setFallbackMode(true);
      setNotice("密碼索引資料暫時無法讀取，以下為安全範例資料。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeEntries = editMode ? draftEntries : entries;

  const filteredEntries = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return activeEntries;
    return activeEntries.filter((entry) =>
      SEARCH_KEYS.some((key) => String(entry[key] || "").toLowerCase().includes(keyword))
    );
  }, [activeEntries, query]);

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

  function startEdit() {
    setNotice("");
    setDraftEntries(fallbackMode ? [] : entries.map((entry) => ({ ...entry })));
    setEditMode(true);
  }

  function cancelEdit() {
    setDraftEntries([]);
    setEditMode(false);
    setSaving(false);
    setNotice("");
  }

  function addDraftEntry() {
    setQuery("");
    setDraftEntries((current) => [
      {
        id: "",
        __tempId: `password-${Date.now()}`,
        __isNew: true,
        category: "",
        system_name: "",
        login_url: "",
        username: "",
        password_item: "",
        notes: "",
        bitwarden_item_name: "",
        bitwarden_item_id: ""
      },
      ...current
    ]);
  }

  function updateDraftEntry(entryKey, key, value) {
    setDraftEntries((current) =>
      current.map((entry) => (entry.id || entry.__tempId) === entryKey ? { ...entry, [key]: value } : entry)
    );
  }

  async function saveEdits() {
    const baseById = new Map(entries.map((entry) => [entry.id, entry]));
    const changes = draftEntries.filter((entry) => {
      if (entry.__isNew) return true;
      return JSON.stringify(baseById.get(entry.id) || {}) !== JSON.stringify(entry);
    });
    if (!changes.length) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      for (const entry of changes) {
        await api("/api/password-entries", {
          method: entry.__isNew ? "POST" : "PATCH",
          body: JSON.stringify({
            id: entry.id,
            data: entry
          })
        });
      }
      await load();
      setDraftEntries([]);
      setEditMode(false);
      setNotice("已儲存");
    } catch (err) {
      setNotice(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section-page password-index-page">
      <header className="section-head">
        <div>
          <h1>密碼管理</h1>
        </div>
        <div className="section-actions">
          {editMode ? (
            <>
              <button type="button" onClick={saveEdits} disabled={saving}>{saving ? "儲存中..." : "儲存"}</button>
              <button type="button" onClick={cancelEdit} disabled={saving}>取消</button>
            </>
          ) : (
            <>
              <button type="button" onClick={load}>重新整理</button>
              <button type="button" onClick={startEdit} aria-label="編輯">✎ 編輯</button>
            </>
          )}
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
        {editMode ? <button type="button" onClick={addDraftEntry}>＋ 新增資料</button> : null}
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
                const entryKey = entry.id || entry.__tempId;

                return (
                  <tr key={entryKey}>
                    <td>
                      {editMode ? (
                        <input value={entry.category || ""} onChange={(event) => updateDraftEntry(entryKey, "category", event.target.value)} aria-label="分類" />
                      ) : (
                        displayValue(entry.category)
                      )}
                    </td>
                    <td>
                      {editMode ? (
                        <>
                          <input value={entry.system_name || ""} onChange={(event) => updateDraftEntry(entryKey, "system_name", event.target.value)} aria-label="系統名稱" />
                          <input value={entry.bitwarden_item_name || ""} onChange={(event) => updateDraftEntry(entryKey, "bitwarden_item_name", event.target.value)} aria-label="Bitwarden 項目" />
                        </>
                      ) : (
                        <>
                          <strong>{displayValue(entry.system_name)}</strong>
                          {vaultItem ? <small>Bitwarden: {vaultItem}</small> : null}
                        </>
                      )}
                    </td>
                    <td>
                      {editMode ? (
                        <input value={entry.login_url || ""} onChange={(event) => updateDraftEntry(entryKey, "login_url", event.target.value)} aria-label="登入網址" />
                      ) : entry.login_url ? (
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
                          {editMode ? (
                            <input value={entry.username || ""} onChange={(event) => updateDraftEntry(entryKey, "username", event.target.value)} aria-label="帳號" />
                          ) : (
                            <strong>{username}</strong>
                          )}
                        </div>
                        <div>
                          <span>密碼</span>
                          {editMode ? (
                            <input
                              value={entry.password_item || ""}
                              onChange={(event) => updateDraftEntry(entryKey, "password_item", event.target.value)}
                              aria-label="密碼索引"
                              type="password"
                              autoComplete="off"
                            />
                          ) : (
                            <strong aria-label="密碼已隱藏">••••••••</strong>
                          )}
                        </div>
                        <div className="password-inline-actions">
                          <button type="button" onClick={notifyBitwardenPending}>顯示密碼</button>
                          <button type="button" onClick={notifyBitwardenPending}>複製密碼</button>
                        </div>
                      </div>
                    </td>
                    <td className="password-notes-cell">
                      {editMode ? (
                        <textarea value={entry.notes || ""} onChange={(event) => updateDraftEntry(entryKey, "notes", event.target.value)} aria-label="備註" rows={2} />
                      ) : (
                        displayValue(entry.notes)
                      )}
                    </td>
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
