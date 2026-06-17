"use client";

import { useEffect, useMemo, useState } from "react";

const SOC_SOP_PUBLIC_URL =
  "https://oidfglrsqrtiimqjfriw.supabase.co/storage/v1/object/public/sop-files/soc/soc-mis-checklist-official.xlsx";
const SOC_SOP_TITLE = "SOC MIS 標準作業檢查表";
const SOC_SOP_DESCRIPTION = "SOC 日常標準作業檢查使用";

const DATA_SECTION_CONFIGS = {
  contacts: { title: "通訊錄", source: "contacts", hint: "分機、專線、手機與 Email 查詢" },
  anydesk: { title: "AnyDesk List", source: "anydesk", hint: "遠端連線設備索引" },
  assets: { title: "設備清單", source: "assets", hint: "全館設備資料總覽" },
  assets_downhill_pc: { title: "山下電腦", source: "assets_downhill_pc", hint: "設備清單 / 山下電腦" },
  assets_printer: { title: "印表機", source: "assets_printer", hint: "設備清單 / 印表機" },
  assets_north_ya: { title: "北 YA", source: "assets_north_ya", hint: "設備清單 / 北 YA" },
  assets_iptv: { title: "IPTV", source: "assets_iptv", hint: "設備清單 / IPTV" },
  contracts: { title: "合約總覽", source: "contracts", hint: "合約與維護期限總覽" },
  contracts_software: { title: "軟體合約", source: "contracts_software", hint: "軟體授權、廠商與到期日追蹤" },
  contracts_mobile: { title: "行動電話約期", source: "contracts_mobile", hint: "門號、方案與合約期限" },
  sop: { title: "SOP 文件", source: "sop", hint: "標準作業文件清單" },
  sop_docs: { title: "SOP", source: "sop", hint: "SOP 文件", presetKeyword: "SOP" },
  soc_docs: { title: "SOC", source: "soc_docs", hint: "SOC 文件" }
};

const CONTACT_COLUMNS = [
  { label: "部門", keys: ["部門", "單位", "department", "?桐?", "å®ä½"] },
  { label: "職稱", keys: ["職稱", "title_zh", "title", "Position", "?瑞迂", "è·ç¨±"] },
  { label: "姓名", keys: ["姓名", "name_zh", "Name", "name", "憪?", "å§å"] },
  { label: "分機", keys: ["分機", "extension", "Extension", "?? Extension", "åæ© Extension"] },
  { label: "中華電信 *55", keys: ["中華電信 *55", "cht_mobile", "銝剛?颱縑 *55", "ä¸­è¯é»ä¿¡ *55"] },
  { label: "個人行動電話", keys: ["個人行動電話", "mobile_phone", "phone", "?犖銵??餉店", "åäººè¡åé»è©±"] },
  { label: "Email", keys: ["Email", "email", "E-mail address"] }
];

const ASSET_COLUMNS = [
  { label: "資產類型", keys: ["資產類型", "asset_type", "鞈憿?", "è³ç¢é¡å"] },
  { label: "設備名稱", keys: ["設備名稱", "asset_name", "閮剖??迂", "è¨­ååç¨±"] },
  { label: "電腦名稱", keys: ["電腦名稱", "computer_name", "?餉?迂", "é»è\u0085¦åç¨±"] },
  { label: "部門", keys: ["部門", "department", "?券?", "é¨é"] },
  { label: "使用人", keys: ["使用人", "使用者", "user_name", "雿輻鈭?", "ä½¿ç¨äºº"] },
  { label: "IP", keys: ["IP", "IP 位址", "ip_address", "IP雿蔭", "IPä½ç½®"] },
  { label: "MAC", keys: ["MAC", "mac_address", "MAC雿蔭", "MACä½ç½®"] },
  { label: "主機型號", keys: ["主機型號", "model", "銝餅???", "ä¸»æ©åè"] },
  { label: "螢幕型號", keys: ["螢幕型號", "monitor_model", "?Ｗ???", "è¢å¹åè"] },
  { label: "Windows 版本", keys: ["Windows 版本", "windows_version", "WINDOWS?", "WINDOWSçæ¬"] },
  { label: "防毒", keys: ["防毒", "antivirus_installed", "?臬鋆瘥?", "æ¯å¦è£é²æ¯"] },
  { label: "狀態", keys: ["狀態", "status", "???", "çæ\u0085"] },
  { label: "盤點狀態", keys: ["盤點狀態", "inventory_status", "?日????", "ç¤é»çæ\u0085"] },
  { label: "備註", keys: ["備註", "note", "?酉", "åè¨»", "ç¤é»åè¨»"] },
  { label: "最後更新", keys: ["最後更新", "updated_at", "?敺??", "æå¾æ´æ°"] }
];

const RECORD_COLUMN_CONFIGS = {
  contacts: CONTACT_COLUMNS,
  anydesk: [
    { label: "設備名稱", keys: ["設備名稱", "device_name", "閮剖??迂", "è¨­ååç¨±"] },
    { label: "AnyDesk ID", keys: ["AnyDesk ID", "anydesk_id"] },
    { label: "密碼", keys: ["密碼", "password", "撖Ⅳ", "å¯ç¢¼"] },
    { label: "備註", keys: ["備註", "note", "?酉", "åè¨»"] },
    { label: "最後確認時間", keys: ["最後確認時間", "last_checked_at", "?敺Ⅱ隤??", "æå¾ç¢ºèªæé"] }
  ],
  contracts: [
    { label: "編號", keys: ["id"] },
    { label: "合約名稱", keys: ["contract_name", "合約名稱"] },
    { label: "廠商", keys: ["vendor", "廠商"] },
    { label: "開始日", keys: ["start_date", "開始日"] },
    { label: "到期日", keys: ["end_date", "到期日"] },
    { label: "金額", keys: ["amount", "金額"] },
    { label: "負責人", keys: ["owner", "負責人"] },
    { label: "狀態", keys: ["status", "狀態"] },
    { label: "備註", keys: ["note", "備註"] }
  ],
  contracts_software: [
    { label: "編號", keys: ["id"] },
    { label: "合約名稱", keys: ["contract_name", "合約名稱"] },
    { label: "廠商", keys: ["vendor", "廠商"] },
    { label: "開始日", keys: ["start_date", "開始日"] },
    { label: "到期日", keys: ["end_date", "到期日"] },
    { label: "金額", keys: ["amount", "金額"] },
    { label: "負責人", keys: ["owner", "負責人"] },
    { label: "狀態", keys: ["status", "狀態"] },
    { label: "備註", keys: ["note", "備註"] }
  ],
  contracts_mobile: [
    { label: "編號", keys: ["id"] },
    { label: "門號", keys: ["phone_no", "phone", "mobile_no", "門號"] },
    { label: "使用者", keys: ["short_code", "user", "user_name", "使用者"] },
    { label: "部門", keys: ["department", "部門"] },
    { label: "電信商", keys: ["carrier", "電信商"] },
    { label: "方案", keys: ["plan", "方案"] },
    { label: "開始日", keys: ["start_date", "開始日"] },
    { label: "到期日", keys: ["end_date", "expire_date", "到期日"] },
    { label: "金額", keys: ["amount", "金額"] },
    { label: "狀態", keys: ["status", "狀態"] },
    { label: "備註", keys: ["note", "備註"] }
  ],
  sop: [
    { label: "SOP 編號", keys: ["sop_id", "SOP 編號", "編號"] },
    { label: "名稱", keys: ["sop_name", "名稱", "title"] },
    { label: "分類", keys: ["category", "分類"] },
    { label: "系統", keys: ["system_name", "系統"] },
    { label: "部門", keys: ["department", "部門"] },
    { label: "版本", keys: ["version", "版本"] },
    { label: "狀態", keys: ["status", "狀態"] },
    { label: "負責人", keys: ["owner", "負責人"] }
  ],
  assets: ASSET_COLUMNS,
  assets_downhill_pc: ASSET_COLUMNS,
  assets_printer: ASSET_COLUMNS,
  assets_north_ya: ASSET_COLUMNS,
  assets_iptv: ASSET_COLUMNS
};

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "資料讀取失敗");
  return data.data;
}

export function getField(record, keys = [], fallback = "") {
  const data = record?.data || record || {};
  const candidates = Array.isArray(keys) ? keys : [keys];
  for (const key of candidates) {
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (value !== null && value !== undefined && String(value).trim() !== "") return value;
    }
  }
  const normalizedCandidates = candidates.map((key) => String(key).replace(/\s+/g, "").toLowerCase());
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = String(key).replace(/\s+/g, "").toLowerCase();
    if (normalizedCandidates.includes(normalizedKey) && value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function formatDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getRecordField(data, column) {
  return getField(data, column.keys, "");
}

function getStatusTone(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "pending";
  if (text.includes("完成") || text.includes("done") || text.includes("有效") || text.includes("active") || text.includes("valid")) return "done";
  if (text.includes("異常") || text.includes("逾期") || text.includes("error") || text.includes("失效")) return "danger";
  if (text.includes("進行") || text.includes("處理")) return "active";
  return "pending";
}

function StatusBadge({ value }) {
  const text = formatDisplayValue(value);
  if (text === "-") return <span className="muted">-</span>;
  return <span className={`inventory-badge ${getStatusTone(text)}`}>{text}</span>;
}

function RecordValue({ value, column }) {
  if (column?.label === "狀態" || column?.label === "盤點狀態") return <StatusBadge value={value} />;
  const text = formatDisplayValue(value);
  return text === "-" ? <span className="muted">-</span> : <span title={text}>{text}</span>;
}

function parseMoneyValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNtAmount(value) {
  return `NT$${Math.round(value).toLocaleString("en-US")}`;
}

function parseRecordDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isActiveContractStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["active", "valid", "啟用", "有效", "正常", "使用中"].some((item) => status.includes(item.toLowerCase()));
}

function getSoftwareContractSummary(rows) {
  const vendorSet = new Set();
  let annualTotal = 0;
  let expiringSoon = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ninetyDaysLater = new Date(today);
  ninetyDaysLater.setDate(today.getDate() + 90);

  rows.forEach((row) => {
    const vendor = String(getField(row, ["vendor", "廠商"]) || "").trim();
    if (vendor && vendor !== "-") vendorSet.add(vendor);
    annualTotal += parseMoneyValue(getField(row, ["amount", "金額"]));
    const endDate = parseRecordDate(getField(row, ["end_date", "到期日"]));
    const status = getField(row, ["status", "狀態"]);
    if (endDate && endDate >= today && endDate <= ninetyDaysLater && isActiveContractStatus(status)) expiringSoon += 1;
  });

  return [
    { title: "廠商數", value: vendorSet.size.toLocaleString("en-US"), helper: "合作廠商" },
    { title: "合約數", value: rows.length.toLocaleString("en-US"), helper: "軟體合約" },
    { title: "年度金額", value: formatNtAmount(annualTotal), helper: "合約金額合計" },
    { title: "90 天內到期", value: expiringSoon.toLocaleString("en-US"), helper: "需提前追蹤", tone: "warning" }
  ];
}

function SoftwareContractSummary({ rows, loading }) {
  const cards = useMemo(() => getSoftwareContractSummary(rows), [rows]);
  return (
    <div className="contract-summary-grid" aria-label="軟體合約摘要">
      {cards.map((card) => (
        <article className={`contract-summary-card ${card.tone === "warning" ? "is-warning" : ""}`} key={card.title}>
          <div>
            <span>{card.title}</span>
            <strong>{loading ? "..." : card.value}</strong>
          </div>
          <p>{card.helper}</p>
        </article>
      ))}
    </div>
  );
}

function getSopUrl(row) {
  return getField(row, ["drive_url", "document_url", "file_url", "url", "link", "連結", "文件"], "");
}

function isEnabledSopStatus(status) {
  const value = String(status || "").toLowerCase();
  return value.includes("active") || value.includes("啟用") || value.includes("生效");
}

function SopCardList({ rows, loading }) {
  if (loading) return <div className="sop-card-empty">讀取 SOP 清單中...</div>;
  if (!rows.length) return <div className="sop-card-empty">目前沒有符合條件的 SOP 文件</div>;

  return (
    <div className="sop-card-list">
      {rows.map((row) => {
        const id = getField(row, ["sop_id", "SOP 編號", "編號"], row.record_key || "");
        const name = getField(row, ["sop_name", "名稱", "title"], "未命名 SOP");
        const category = getField(row, ["category", "分類"], "未分類");
        const status = getField(row, ["status", "狀態"], "未設定");
        const owner = getField(row, ["owner", "負責人"], "-");
        const version = getField(row, ["version", "版本"], "-");
        const url = getSopUrl(row);

        return (
          <article className="sop-card" key={row.id || row.record_key || id}>
            <div className="sop-card-main">
              <div className="sop-card-title-row">
                <h2 title={String(name)}>{name}</h2>
                <span className={`sop-status-badge ${isEnabledSopStatus(status) ? "is-enabled" : ""}`}>
                  {isEnabledSopStatus(status) ? "啟用" : status}
                </span>
              </div>
              <div className="sop-card-meta">
                <span>{id || "-"}</span>
                <span className="sop-category-badge">{category}</span>
                <span>版本 {version}</span>
                <span>負責人 {owner}</span>
              </div>
            </div>
            {url ? (
              <a className="sop-open-button" href={String(url)} target="_blank" rel="noreferrer">
                開啟文件
              </a>
            ) : (
              <button className="sop-open-button is-disabled" type="button" disabled>
                無文件連結
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function formatSocUpdatedAt(value) {
  if (!value) return "最近更新：未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新：未設定";
  return `最近更新：${new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)}`;
}

function getSocDocumentUrl(row) {
  const fileUrl = String(getField(row, ["file_url"], "") || "").trim();
  return fileUrl === SOC_SOP_PUBLIC_URL ? fileUrl : SOC_SOP_PUBLIC_URL;
}

function SocDocumentCard({ rows, loading }) {
  if (loading) return <div className="sop-card-empty">讀取 SOC 文件中...</div>;
  if (!rows.length) return <div className="sop-card-empty">目前尚未設定 SOC SOP 文件</div>;

  const row = rows[0];
  const title = SOC_SOP_TITLE;
  const version = getField(row, ["version"], "正式版");
  const description = SOC_SOP_DESCRIPTION;
  const fileUrl = getSocDocumentUrl(row);
  const updatedAt = getField(row, ["updated_at"], "");

  return (
    <article className="soc-document-card">
      <div className="soc-document-icon" aria-hidden="true">XLSX</div>
      <div className="soc-document-main">
        <div className="soc-document-title-row">
          <h2 title={String(title)}>{title}</h2>
          <span className="sop-status-badge is-enabled">{version}</span>
        </div>
        <p>{description}</p>
        <div className="sop-card-meta">
          <span>{formatSocUpdatedAt(updatedAt)}</span>
        </div>
      </div>
      <div className="soc-document-actions">
        {fileUrl ? (
          <>
            <a className="sop-open-button" href={String(fileUrl)} target="_blank" rel="noreferrer">
              開啟文件
            </a>
            <a className="sop-open-button" href={String(fileUrl)} download>
              下載 Excel
            </a>
          </>
        ) : (
          <button className="sop-open-button is-disabled" type="button" disabled>
            尚未設定連結
          </button>
        )}
      </div>
    </article>
  );
}

function getRecordRowClass(source, extra = "") {
  return [
    "record-row",
    extra,
    source === "contracts_software" ? "software-contract-row" : "",
    source === "contracts_mobile" ? "mobile-contract-row" : "",
    source === "assets" ? "asset-record-row" : "",
    source === "contacts" ? "contact-record-row" : ""
  ].filter(Boolean).join(" ");
}

export default function DataSectionPage({ sectionKey }) {
  const config = DATA_SECTION_CONFIGS[sectionKey];
  const isSocDocs = sectionKey === "soc_docs";
  const isContacts = config?.source === "contacts";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [department, setDepartment] = useState("全部");

  async function load() {
    if (!config) return;
    setLoading(true);
    setError("");
    try {
      const source = isSocDocs ? "soc_docs" : config.source;
      const data = await api(`/api/records?source=${encodeURIComponent(source)}`);
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuery(config?.presetKeyword || "");
    setDepartment("全部");
    load();
  }, [config?.source, config?.presetKeyword, isSocDocs]);

  const departments = useMemo(() => {
    if (config?.source !== "contacts") return [];
    const values = rows
      .map((row) => String(getField(row, ["部門", "單位", "department", "?桐?", "å®ä½"]) || "").trim())
      .filter(Boolean);
    return ["全部", ...Array.from(new Set(values))];
  }, [config?.source, rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchDepartment =
        config?.source !== "contacts" ||
        department === "全部" ||
        getField(row, ["部門", "單位", "department", "?桐?", "å®ä½"]) === department;
      const matchKeyword = !keyword || JSON.stringify(row.data || {}).toLowerCase().includes(keyword);
      return matchDepartment && matchKeyword;
    });
  }, [rows, query, department, config?.source]);

  const columns = useMemo(() => RECORD_COLUMN_CONFIGS[config?.source] || [], [config?.source]);

  if (!config) {
    return (
      <section className="section-page">
        <div className="empty">找不到此資料區塊</div>
      </section>
    );
  }

  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <p>{config.hint}</p>
        </div>
        <div className="section-actions">
          <button onClick={load}>重新整理</button>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      {config.source === "contracts_software" ? <SoftwareContractSummary rows={rows} loading={loading} /> : null}
      {!isSocDocs ? (
        <div className={`records-toolbar ${isContacts ? "contact-records-toolbar" : ""}`}>
          {isContacts ? (
            <span className="records-summary">
              {loading ? "讀取中..." : `共 ${filteredRows.length.toLocaleString("en-US")} 筆通訊錄資料`}
            </span>
          ) : (
            <>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋關鍵字..." />
              <span className="records-summary">{loading ? "讀取中..." : `${filteredRows.length.toLocaleString("en-US")} 筆`}</span>
            </>
          )}
        </div>
      ) : null}
      {departments.length ? (
        <div className="department-filters">
          {departments.map((item) => (
            <button
              key={item}
              type="button"
              className={department === item ? "active" : ""}
              onClick={() => setDepartment(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {isSocDocs ? (
        <SocDocumentCard rows={rows} loading={loading} />
      ) : config.source === "sop" ? (
        <SopCardList rows={filteredRows} loading={loading} />
      ) : (
        <div className="records-table">
          {loading ? (
            <div className="empty">讀取資料中...</div>
          ) : filteredRows.length === 0 ? (
            <div className="empty">目前沒有符合條件的資料</div>
          ) : (
            <>
              <div className={getRecordRowClass(config.source, "record-head")}>
                {columns.map((column) => <span key={column.label}>{column.label}</span>)}
              </div>
              {filteredRows.map((row) => (
                <div className={getRecordRowClass(config.source)} key={row.id || row.record_key}>
                  {columns.map((column) => (
                    <RecordValue key={column.label} column={column} value={getRecordField(row, column)} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
