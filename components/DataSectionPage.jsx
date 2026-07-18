"use client";

import { useEffect, useMemo, useState } from "react";
import {
  blankDraftRow,
  changedRows,
  cloneRows,
  fieldKeyForColumn,
  getDraftValue,
  hasDraftChanges,
  inputTypeForColumn,
  isEditableColumn,
  isSelectColumn,
  isTextareaColumn,
  normalizeDateInput,
  optionsForColumn,
  rowIdentity,
  setDraftValue,
  useUnsavedChangesWarning
} from "./dataEditMode";
import { getContractLifecycleStatus, isContractExpiringWithin } from "../lib/contractStatus";
import AssetHistoryDialog from "./AssetHistoryDialog";

const SOC_SOP_PUBLIC_URL =
  "https://oidfglrsqrtiimqjfriw.supabase.co/storage/v1/object/public/sop-files/soc/soc-mis-checklist-official.xlsx";
const SOC_SOP_TITLE = "SOC MIS 標準作業檢查表";
const SOC_SOP_DESCRIPTION = "SOC 日常標準作業檢查使用";
const ASSET_LIFECYCLE_COLUMNS = [
  { label: "採購日", keys: ["purchase_date"], editable: false },
  { label: "保固狀態", keys: ["warranty_status_label"], editable: false },
  { label: "設備履歷", keys: ["asset_history_action"], editable: false }
];

const DATA_SECTION_CONFIGS = {
  contacts: { title: "通訊錄", source: "contacts", hint: "分機、專線、手機與 Email 查詢" },
  anydesk: { title: "AnyDesk List", source: "anydesk", hint: "遠端連線設備索引" },
  assets: { title: "設備清單", source: "assets", hint: "全館設備資料總覽" },
  assets_downhill_pc: { title: "山下電腦", source: "assets_downhill_pc", hint: "" },
  assets_printer: { title: "印表機", source: "assets_printer", hint: "" },
  assets_north_ya: { title: "北 YA", source: "assets_north_ya", hint: "" },
  assets_iptv: { title: "IPTV", source: "assets_iptv", hint: "" },
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
  { label: "分機", keys: ["分機", "分機 Extension", "extension", "Extension", "?? Extension", "åæ© Extension"] },
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
  { label: "最後更新", keys: ["最後更新", "updated_at", "?敺??", "æå¾æ´æ°"] },
  ...ASSET_LIFECYCLE_COLUMNS
];

const PRINTER_COLUMNS = [
  { label: "設備名稱", keys: ["電腦名稱", "設備名稱", "asset_name"] },
  { label: "類型", keys: ["設備類型", "資產類型", "asset_type"] },
  { label: "IP 位址", keys: ["IP 位址", "IP位置", "IP位址", "ip_address"] },
  { label: "使用部門", keys: ["使用部門", "部門", "department"] },
  { label: "硬體型號", keys: ["硬體型號", "主機型號", "model"] },
  { label: "碳粉/墨水", keys: ["碳粉/墨水型號 ", "碳粉/墨水型號", "耗材", "note"] },
  { label: "資產狀態", keys: ["資產狀態", "狀態", "status"] },
  { label: "最後更新", keys: ["最後更新", "最後更新時間", "updated_at"] },
  ...ASSET_LIFECYCLE_COLUMNS
];

const NORTH_YA_COLUMNS = [
  { label: "職稱", keys: ["職稱", "title"] },
  { label: "使用者", keys: ["使用者", "使用人", "user_name"] },
  { label: "電腦名稱", keys: ["電腦名稱", "asset_name"] },
  { label: "IP 位址", keys: ["IP位址", "IP 位址", "IP", "ip_address"] },
  { label: "主機品牌", keys: ["主機品牌", "主機型號", "model"] },
  { label: "Windows", keys: ["WINDOWS版本", "Windows 版本", "windows_version"] },
  { label: "螢幕尺寸", keys: ["螢幕尺寸", "螢幕型號", "monitor_model"] },
  { label: "AnyDesk ID", keys: ["Anydesk ID", "AnyDesk ID", "anydesk_id"] },
  { label: "更新時間", keys: ["資料更新時間", "最後更新", "updated_at"] },
  { label: "備註", keys: ["備註", "note"] },
  ...ASSET_LIFECYCLE_COLUMNS
];

const IPTV_COLUMNS = [
  { label: "名稱", keys: ["名稱", "頻道", "asset_name"] },
  { label: "IP", keys: ["IP", "IP 位址", "ip_address"] },
  { label: "TS", keys: ["TS"] },
  { label: "MAC", keys: ["MAC", "mac_address"] },
  { label: "原始網路欄位", keys: ["原始網路欄位"] },
  ...ASSET_LIFECYCLE_COLUMNS
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
    { label: "狀態", keys: ["status", "狀態"], options: ["有效", "即期", "中止"], defaultValue: "有效" },
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
  assets_printer: PRINTER_COLUMNS,
  assets_north_ya: NORTH_YA_COLUMNS,
  assets_iptv: IPTV_COLUMNS
};

const EDITABLE_DATA_SOURCES = new Set([
  "anydesk",
  "assets_downhill_pc",
  "assets_printer",
  "assets_north_ya",
  "contracts_software",
  "contracts_mobile"
]);

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
  if (text.includes("完成") || text.includes("正常") || text.includes("✅") || text.includes("done") || text.includes("有效") || text.includes("active") || text.includes("valid")) return "done";
  if (text.includes("異常") || text.includes("逾期") || text.includes("error") || text.includes("失效") || text.includes("中止")) return "danger";
  if (text.includes("進行") || text.includes("處理")) return "active";
  if (text.includes("需") || text.includes("⚠") || text.includes("即期")) return "pending";
  return "pending";
}

function StatusBadge({ value }) {
  const text = formatDisplayValue(value);
  if (text === "-") return <span className="muted">-</span>;
  return <span className={`inventory-badge ${getStatusTone(text)}`}>{text}</span>;
}

function RecordValue({ value, column }) {
  if (["狀態", "盤點狀態", "資產狀態"].includes(column?.label)) return <StatusBadge value={value} />;
  if (column?.label === "保固狀態") {
    const label = String(value || "未設定");
    const tone = label === "保固中" ? "active" : label === "即將到期" ? "expiring" : label === "已過保" ? "expired" : "unset";
    return <span className={`asset-warranty-badge is-${tone}`}>{label}</span>;
  }
  const text = formatDisplayValue(value);
  return text === "-" ? <span className="muted">-</span> : <span title={text}>{text}</span>;
}

function EditableRecordValue({ row, column, rows, onChange }) {
  const value = getDraftValue(row, column);
  const fieldKey = fieldKeyForColumn(row, column);
  const options = optionsForColumn(rows, column);
  if (isTextareaColumn(column)) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={column.label}
        rows={2}
      />
    );
  }
  if (isSelectColumn(column) && options.length) {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={column.label}>
        <option value=""></option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      value={inputTypeForColumn(column) === "date" ? normalizeDateInput(value) : value}
      onChange={(event) => onChange(event.target.value)}
      type={inputTypeForColumn(column)}
      inputMode={column.label === "金額" ? "decimal" : undefined}
      aria-label={column.label || fieldKey}
    />
  );
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

function getSoftwareContractSummary(rows) {
  const vendorSet = new Set();
  let annualTotal = 0;
  let expiringSoon = 0;

  rows.forEach((row) => {
    const vendor = String(getField(row, ["vendor", "廠商"]) || "").trim();
    if (vendor && vendor !== "-") vendorSet.add(vendor);
    annualTotal += parseMoneyValue(getField(row, ["amount", "金額"]));
    if (isContractExpiringWithin(row?.data || row, undefined, 30)) expiringSoon += 1;
  });

  return [
    { title: "廠商數", value: vendorSet.size.toLocaleString("en-US"), helper: "合作廠商" },
    { title: "合約數", value: rows.length.toLocaleString("en-US"), helper: "軟體合約" },
    { title: "年度金額", value: formatNtAmount(annualTotal), helper: "合約金額合計" },
    { title: "30 天內即期", value: expiringSoon.toLocaleString("en-US"), helper: "行事曆橘點提醒", tone: "warning" }
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

function formatContractAmount(value) {
  if (value === null || value === undefined || value === "") return "-";
  return formatNtAmount(parseMoneyValue(value));
}

function ContractDetailModal({ fallbackRow, detail, loading, error, onClose }) {
  const fallback = fallbackRow?.data || fallbackRow || {};
  const contract = detail?.contract || fallback;
  const history = Array.isArray(detail?.history) ? detail.history : [];
  const name = getField(contract, ["contract_name", "合約名稱"], "未命名合約");
  const status = getContractLifecycleStatus(contract, undefined, 30);
  const fields = [
    ["合約編號", getField(contract, ["id", "編號"], fallbackRow?.id || "-")],
    ["廠商", getField(contract, ["vendor", "廠商"], "-")],
    ["開始日", getField(contract, ["start_date", "開始日"], "-")],
    ["到期日", getField(contract, ["end_date", "到期日"], "-")],
    ["目前價格", formatContractAmount(getField(contract, ["amount", "金額"], ""))],
    ["負責人", getField(contract, ["owner", "負責人"], "-")]
  ];

  return (
    <div className="contract-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="contract-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="contract-detail-head">
          <div>
            <span>軟體合約詳細資料</span>
            <h2 id="contract-detail-title">{name}</h2>
          </div>
          <div className="contract-detail-head-actions">
            <StatusBadge value={status} />
            <button type="button" onClick={onClose} aria-label="關閉合約詳細資料">×</button>
          </div>
        </header>

        <dl className="contract-detail-grid">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatDisplayValue(value)}</dd>
            </div>
          ))}
        </dl>

        <div className="contract-detail-note">
          <span>備註</span>
          <p>{getField(contract, ["note", "備註"], "目前沒有備註")}</p>
        </div>

        <section className="contract-price-history" aria-label="價格沿革">
          <header>
            <div>
              <h3>價格沿革</h3>
              <p>每次修改合約金額都會自動留下紀錄</p>
            </div>
            {!loading && !error ? <b>{history.length} 筆</b> : null}
          </header>
          {loading ? (
            <div className="contract-history-state">讀取價格紀錄中...</div>
          ) : error ? (
            <div className="contract-history-state is-error">{error}</div>
          ) : history.length ? (
            <div className="contract-price-timeline">
              {history.map((entry, index) => (
                <article key={entry.id || `${entry.effective_date}-${index}`}>
                  <i aria-hidden="true" />
                  <div>
                    <span>{entry.effective_date || "未設定日期"}</span>
                    <strong>{formatContractAmount(entry.amount)}</strong>
                    <small>{entry.note || (index === 0 ? "目前價格" : "價格調整")}</small>
                  </div>
                  {index === 0 ? <b>目前</b> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="contract-history-state">目前尚無價格紀錄</div>
          )}
        </section>
      </section>
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
    source === "assets_printer" ? "printer-record-row" : "",
    source === "assets_north_ya" ? "north-ya-record-row" : "",
    source === "assets_iptv" ? "iptv-record-row" : "",
    source === "contacts" ? "contact-record-row" : ""
  ].filter(Boolean).join(" ");
}

export default function DataSectionPage({ sectionKey }) {
  const config = DATA_SECTION_CONFIGS[sectionKey];
  const isSocDocs = sectionKey === "soc_docs";
  const isContacts = config?.source === "contacts";
  const isAssetSection = config?.source === "assets" || config?.source?.startsWith("assets_");
  const canEdit = EDITABLE_DATA_SOURCES.has(config?.source);
  const [rows, setRows] = useState([]);
  const [draftRows, setDraftRows] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [department, setDepartment] = useState("全部");
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractDetail, setContractDetail] = useState(null);
  const [contractDetailLoading, setContractDetailLoading] = useState(false);
  const [contractDetailError, setContractDetailError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const hasUnsavedChanges = editMode && hasDraftChanges(rows, draftRows);

  useUnsavedChangesWarning(hasUnsavedChanges);

  async function load() {
    if (!config) return;
    setLoading(true);
    setError("");
    try {
      const source = isSocDocs ? "soc_docs" : config.source;
      const data = await api(`/api/records?source=${encodeURIComponent(source)}`);
      setRows(data.rows || []);
      if (editMode) setDraftRows(cloneRows(data.rows || []));
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

  useEffect(() => {
    if (!selectedContract) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape") setSelectedContract(null);
    }
    document.body.classList.add("contract-detail-open");
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("contract-detail-open");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedContract]);

  const activeRows = editMode ? draftRows : rows;

  const departments = useMemo(() => {
    if (config?.source !== "contacts") return [];
    const values = rows
      .map((row) => String(getField(row, ["部門", "單位", "department", "?桐?", "å®ä½"]) || "").trim())
      .filter(Boolean);
    return ["全部", ...Array.from(new Set(values))];
  }, [config?.source, rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return activeRows.filter((row) => {
      const matchDepartment =
        config?.source !== "contacts" ||
        department === "全部" ||
        getField(row, ["部門", "單位", "department", "?桐?", "å®ä½"]) === department;
      const matchKeyword = !keyword || JSON.stringify(row.data || {}).toLowerCase().includes(keyword);
      return matchDepartment && matchKeyword;
    });
  }, [activeRows, query, department, config?.source]);

  const columns = useMemo(() => {
    const baseColumns = RECORD_COLUMN_CONFIGS[config?.source] || [];
    if (config?.source !== "contracts_software") return baseColumns;
    return baseColumns.filter((column) => !(column.keys || []).includes("owner"));
  }, [config?.source]);

  function startEdit() {
    setSaveNotice("");
    setError("");
    setDraftRows(cloneRows(rows));
    setEditMode(true);
  }

  function cancelEdit() {
    setDraftRows([]);
    setEditMode(false);
    setSaving(false);
    setSaveNotice("");
    setError("");
  }

  function addDraftRow() {
    setQuery("");
    setDraftRows((current) => [blankDraftRow(columns, config.source), ...current]);
  }

  function updateDraftCell(rowKey, column, value) {
    setDraftRows((current) => setDraftValue(current, rowKey, column, value));
  }

  async function openContractDetail(row) {
    const id = String(row?.id || getField(row, ["id", "編號"], "")).trim();
    if (!id) return;
    setSelectedContract(row);
    setContractDetail(null);
    setContractDetailError("");
    setContractDetailLoading(true);
    try {
      const data = await api(`/api/contracts/${encodeURIComponent(id)}/history`);
      setContractDetail(data);
    } catch (err) {
      setContractDetailError(err.message || "價格紀錄讀取失敗");
    } finally {
      setContractDetailLoading(false);
    }
  }

  function closeContractDetail() {
    setSelectedContract(null);
    setContractDetail(null);
    setContractDetailError("");
    setContractDetailLoading(false);
  }

  async function saveEdits() {
    const changes = changedRows(rows, draftRows);
    if (!changes.length) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setError("");
    setSaveNotice("");
    try {
      for (const row of changes) {
        await api("/api/records", {
          method: row.__isNew ? "POST" : "PATCH",
          body: JSON.stringify({
            source: config.source,
            id: row.id,
            data: row.data || {}
          })
        });
      }
      await load();
      setDraftRows([]);
      setEditMode(false);
      setSaveNotice("已儲存");
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <section className="section-page">
        <div className="empty">找不到此資料區塊</div>
      </section>
    );
  }

  return (
    <section className={`section-page ${isAssetSection ? "asset-section-page" : ""}`}>
      <header className="section-head">
        <div>
          <h1>{config.title}</h1>
        </div>
        {!canEdit && !isAssetSection ? (
          <div className="section-actions">
            <button onClick={load}>重新整理</button>
          </div>
        ) : null}
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      {saveNotice ? <div className="error-box">{saveNotice}</div> : null}
      {config.source === "contracts_software" ? <SoftwareContractSummary rows={rows} loading={loading} /> : null}
      {!isSocDocs ? (
        <div className={`records-toolbar ${isContacts ? "contact-records-toolbar" : ""} ${isAssetSection ? "asset-records-toolbar" : ""}`}>
          {isContacts ? (
            <span className="records-summary">
              {loading ? "讀取中..." : `共 ${filteredRows.length.toLocaleString("en-US")} 筆通訊錄資料`}
            </span>
          ) : (
            <>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋關鍵字..." />
              <span className="records-summary">{loading ? "讀取中..." : `${filteredRows.length.toLocaleString("en-US")} 筆`}</span>
              {canEdit ? (
                <div className="data-edit-toolbar-actions">
                  {editMode ? (
                    <>
                      <button type="button" onClick={saveEdits} disabled={saving}>{saving ? "儲存中..." : "儲存"}</button>
                      <button type="button" onClick={cancelEdit} disabled={saving}>取消</button>
                      <button type="button" onClick={addDraftRow}>＋ 新增資料</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={load}>重新整理</button>
                      <button type="button" onClick={startEdit} aria-label="編輯">✎ 編輯</button>
                    </>
                  )}
                </div>
              ) : isAssetSection ? <button onClick={load}>重新整理</button> : null}
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
                <div className={getRecordRowClass(config.source)} key={rowIdentity(row)}>
                  {columns.map((column) => {
                    if (editMode && isEditableColumn(column)) {
                      return (
                        <EditableRecordValue
                          key={column.label}
                          row={row}
                          column={column}
                          rows={draftRows}
                          onChange={(value) => updateDraftCell(rowIdentity(row), column, value)}
                        />
                      );
                    }
                    if (config.source === "contracts_software" && column.label === "合約名稱") {
                      const name = getRecordField(row, column) || "未命名合約";
                      return (
                        <button
                          className="contract-name-button"
                          type="button"
                          key={column.label}
                          onClick={() => openContractDetail(row)}
                          title={`查看 ${name} 詳細資料與價格沿革`}
                        >
                          {name}
                        </button>
                      );
                    }
                    if (isAssetSection && column.label === "設備履歷") {
                      return (
                        <button
                          className="asset-history-button"
                          type="button"
                          key={column.label}
                          onClick={() => setSelectedAsset(row)}
                        >
                          查看履歷
                        </button>
                      );
                    }
                    return <RecordValue key={column.label} column={column} value={getRecordField(row, column)} />;
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {selectedContract ? (
        <ContractDetailModal
          fallbackRow={selectedContract}
          detail={contractDetail}
          loading={contractDetailLoading}
          error={contractDetailError}
          onClose={closeContractDetail}
        />
      ) : null}
      {selectedAsset ? (
        <AssetHistoryDialog record={selectedAsset} onClose={() => setSelectedAsset(null)} onSaved={load} />
      ) : null}
    </section>
  );
}
