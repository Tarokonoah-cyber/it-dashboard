"use client";

import { useMemo, useState } from "react";

const PASSWORD_INDEX_ITEMS = [
  {
    id: "booking-backoffice",
    name: "Booking.com 後台",
    category: "SaaS",
    risk_level: "General",
    description: "訂房平台後台入口，登入資訊請依 Vault 紀錄為準。",
    owner: "IT",
    login_url: "https://admin.booking.com/",
    vault_provider: "Bitwarden",
    vault_collection: "IT - General",
    vault_item_url: "",
    sop_url: "",
    notes_public: "僅保留入口索引，不顯示帳密。"
  },
  {
    id: "google-business-profile",
    name: "Google Business Profile",
    category: "SaaS",
    risk_level: "General",
    description: "Google 商家檔案管理入口，帳務與權限請至 Vault 查看。",
    owner: "IT",
    login_url: "https://business.google.com/",
    vault_provider: "Bitwarden",
    vault_collection: "IT - General",
    vault_item_url: "",
    sop_url: "",
    notes_public: "僅保留入口索引，不顯示帳密。"
  },
  {
    id: "main-nas",
    name: "主力 NAS",
    category: "NAS",
    risk_level: "Critical",
    description: "主要檔案服務，詳細連線資訊請至 Bitwarden 查看。",
    owner: "IT",
    login_url: "",
    vault_provider: "Bitwarden",
    vault_collection: "IT - Critical",
    vault_item_url: "",
    sop_url: "",
    notes_public: "不可在此頁顯示 IP、帳號、密碼或連線細節。"
  },
  {
    id: "opera-db",
    name: "Opera DB",
    category: "Database",
    risk_level: "Critical",
    description: "飯店系統資料庫索引，詳細連線資訊請至 Bitwarden 查看。",
    owner: "IT",
    login_url: "",
    vault_provider: "Bitwarden",
    vault_collection: "IT - Critical",
    vault_item_url: "",
    sop_url: "",
    notes_public: "不可在此頁顯示 IP、帳號、密碼或連線細節。"
  },
  {
    id: "fortigate-main-firewall",
    name: "Fortigate Main Firewall",
    category: "Network",
    risk_level: "Critical",
    description: "主要防火牆，詳細連線資訊請至 Bitwarden 查看。",
    owner: "IT",
    login_url: "",
    vault_provider: "Bitwarden",
    vault_collection: "IT - Critical",
    vault_item_url: "",
    sop_url: "",
    notes_public: "不可在此頁顯示 IP、帳號、密碼或連線細節。"
  }
];

const PASSWORD_INDEX_SEARCH_KEYS = [
  "name",
  "category",
  "risk_level",
  "description",
  "owner",
  "vault_provider",
  "vault_collection",
  "notes_public"
];

export default function PasswordsPage() {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!keyword) return PASSWORD_INDEX_ITEMS;
    return PASSWORD_INDEX_ITEMS.filter((item) =>
      PASSWORD_INDEX_SEARCH_KEYS.some((key) => String(item[key] || "").toLowerCase().includes(keyword))
    );
  }, [keyword]);

  function copyLoginUrl(item) {
    if (!item.login_url || item.risk_level === "Critical") return;
    navigator.clipboard?.writeText(item.login_url);
  }

  function openUrl(url, fallback) {
    window.open(url || fallback, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="section-page password-index-page">
      <header className="section-head">
        <div>
          <h1>密碼索引與 Vault 入口</h1>
          <p>搜尋系統、分類與負責人，真正密碼請回到 Bitwarden / KeePassXC 管理。</p>
        </div>
      </header>

      <div className="security-notice">
        這裡只保留密碼索引與 Vault 入口，不顯示任何真實密碼、金鑰或私密連線資訊。
        Critical 項目請至 Bitwarden / KeePassXC 查看。
      </div>

      <div className="records-toolbar password-index-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋系統名稱、分類、風險、用途、負責人或 Vault 位置..."
        />
        <span>{filteredItems.length} 筆</span>
      </div>

      {PASSWORD_INDEX_ITEMS.length === 0 ? (
        <div className="password-empty-state">
          <h2>尚未建立密碼索引</h2>
          <p>請先將真實密碼、金鑰、私鑰搬移至 Bitwarden 或 KeePassXC，再於此頁建立索引資料。</p>
          <button className="primary-action" type="button">新增索引項目</button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty">找不到符合條件的索引項目。</div>
      ) : (
        <div className="password-index-table-wrap">
          <table className="password-index-table">
            <thead>
              <tr>
                <th>系統名稱</th>
                <th>分類</th>
                <th>風險等級</th>
                <th>用途 / 說明</th>
                <th>負責人</th>
                <th>密碼位置</th>
                <th>SOP</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isCritical = item.risk_level === "Critical";
                const isSensitive = item.risk_level === "Sensitive";
                const vaultText = `${item.vault_provider} > ${item.vault_collection}`;
                const loginText = isCritical
                  ? "Critical：詳細連線資訊請至 Bitwarden 查看"
                  : isSensitive || item.risk_level === "Internal"
                    ? "請至 Vault 查看"
                    : item.login_url || "請至 Vault 查看";

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{loginText}</small>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <span className={`risk-badge ${item.risk_level.toLowerCase()}`}>{item.risk_level}</span>
                    </td>
                    <td>
                      {item.description}
                      {item.notes_public ? <small>{item.notes_public}</small> : null}
                    </td>
                    <td>{item.owner}</td>
                    <td>{vaultText}</td>
                    <td>{item.sop_url ? <button type="button" onClick={() => openUrl(item.sop_url)}>查看 SOP</button> : <span className="muted">尚未建立</span>}</td>
                    <td>
                      <div className="password-actions">
                        <button type="button" onClick={() => openUrl(item.vault_item_url, "https://vault.bitwarden.com/")}>
                          開啟 Bitwarden
                        </button>
                        {item.sop_url ? <button type="button" onClick={() => openUrl(item.sop_url)}>查看 SOP</button> : null}
                        {!isCritical && item.login_url ? (
                          <button type="button" onClick={() => copyLoginUrl(item)}>複製登入網址</button>
                        ) : null}
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
