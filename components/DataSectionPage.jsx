"use client";

import { useEffect, useMemo, useState } from "react";

const DATA_SECTION_CONFIGS = {
  contacts: { title: "通訊錄", source: "contacts", hint: "原 Sheet：通訊錄" },
  anydesk: { title: "AnyDesk List", source: "anydesk", hint: "原 Sheet：ANYDESK LIST" },
  assets: { title: "設備清單", source: "assets", hint: "整合山上電腦、山下電腦、印表機、北YA、IPTV" },
  assets_downhill_pc: { title: "山下電腦", source: "assets_downhill_pc", hint: "設備清單：山下電腦" },
  assets_printer: { title: "印表機", source: "assets_printer", hint: "設備清單：印表機" },
  assets_north_ya: { title: "北YA", source: "assets_north_ya", hint: "設備清單：北YA" },
  assets_iptv: { title: "IPTV", source: "assets_iptv", hint: "設備清單：IPTV" },
  contracts: { title: "合約總覽", source: "contracts", hint: "原 Sheet：contracts / mobile_contracts" },
  contracts_software: { title: "軟體合約", source: "contracts_software", hint: "合約總覽：軟體合約" },
  contracts_mobile: { title: "行動電話約期", source: "contracts_mobile", hint: "合約總覽：行動電話約期" }
};

const RECORD_COLUMN_CONFIGS = {
  contacts: [
    { label: "單位", keys: ["單位"] },
    { label: "職稱", keys: ["職稱", "Position"] },
    { label: "姓名", keys: ["姓名", "Name"] },
    { label: "分機", keys: ["分機 Extension"] },
    { label: "辦公室", keys: ["辦公室專線 Office"] },
    { label: "中華電信 *55", keys: ["中華電信 *55"] },
    { label: "行動電話", keys: ["行動電話"] },
    { label: "Email", keys: ["E-mail address", "Email"] },
    { label: "最後更新", keys: ["最後更新時間"] }
  ],
  anydesk: [
    { label: "設備名稱", keys: ["設備名稱"] },
    { label: "AnyDesk ID", keys: ["AnyDesk ID"] },
    { label: "密碼", keys: ["密碼"] },
    { label: "備註", keys: ["備註"] },
    { label: "最後確認", keys: ["最後確認時間"] }
  ],
  contracts: [
    { label: "編號", keys: ["id"] },
    { label: "合約名稱", keys: ["contract_name"] },
    { label: "廠商", keys: ["vendor"] },
    { label: "開始日", keys: ["start_date"] },
    { label: "到期日", keys: ["end_date"] },
    { label: "金額", keys: ["amount"] },
    { label: "負責人", keys: ["owner"] },
    { label: "狀態", keys: ["status"] }
  ],
  contracts_software: [
    { label: "編號", keys: ["id"] },
    { label: "合約名稱", keys: ["contract_name"] },
    { label: "廠商", keys: ["vendor"] },
    { label: "開始日", keys: ["start_date"] },
    { label: "到期日", keys: ["end_date"] },
    { label: "金額", keys: ["amount"] },
    { label: "負責人", keys: ["owner"] },
    { label: "狀態", keys: ["status"] }
  ],
  contracts_mobile: [
    { label: "編號", keys: ["id"] },
    { label: "電話號碼", keys: ["phone_no", "phone", "mobile_no", "門號"] },
    { label: "簡碼", keys: ["short_code", "user", "user_name", "簡碼"] },
    { label: "月租費", keys: ["amount", "月租費"] },
    { label: "合約起日", keys: ["start_date", "合約起日"] },
    { label: "合約迄日", keys: ["end_date", "expire_date", "到期日", "合約迄日"] },
    { label: "方案", keys: ["plan", "方案"] },
    { label: "狀態", keys: ["status", "狀態"] },
    { label: "負責人", keys: ["owner", "負責人"] },
    { label: "備註", keys: ["note", "備註"] }
  ],
  assets_default: [
    { label: "資產類型", keys: ["資產類型"] },
    { label: "設備名稱", keys: ["設備名稱", "電腦名稱"] },
    { label: "部門", keys: ["部門"] },
    { label: "使用人", keys: ["使用人"] },
    { label: "IP位置", keys: ["IP位置"] },
    { label: "型號", keys: ["主機型號", "設備型號", "型號"] },
    { label: "狀態", keys: ["狀態", "盤點狀態"] },
    { label: "備註", keys: ["備註", "盤點備註"] }
  ]
};

["assets", "assets_downhill_pc", "assets_printer", "assets_north_ya", "assets_iptv"].forEach((source) => {
  RECORD_COLUMN_CONFIGS[source] = RECORD_COLUMN_CONFIGS.assets_default;
});

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

function RecordValue({ value }) {
  if (value === null || value === undefined || value === "") return <span className="muted">-</span>;
  if (typeof value === "object") return <span>{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

function getRecordField(data, column) {
  for (const key of column.keys || [column.label]) {
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return "";
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
  return ["有效", "active", "valid"].includes(status);
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
    const data = row.data || {};
    const vendor = String(getRecordField(data, { keys: ["vendor", "廠商"] }) || "").trim();
    if (vendor && vendor !== "-") vendorSet.add(vendor);

    annualTotal += parseMoneyValue(getRecordField(data, { keys: ["amount", "金額"] }));

    const endDate = parseRecordDate(getRecordField(data, { keys: ["end_date", "到期日"] }));
    const status = getRecordField(data, { keys: ["status", "狀態"] });
    if (endDate && endDate >= today && endDate <= ninetyDaysLater && isActiveContractStatus(status)) {
      expiringSoon += 1;
    }
  });

  return [
    { title: "廠商數", value: vendorSet.size.toLocaleString("en-US"), helper: "合作廠商" },
    { title: "合約總數", value: rows.length.toLocaleString("en-US"), helper: "軟體合約" },
    { title: "年度費用", value: formatNtAmount(annualTotal), helper: "年度合約金額" },
    { title: "90 天內到期", value: expiringSoon.toLocaleString("en-US"), helper: "需要追蹤", tone: "warning" }
  ];
}

function SoftwareContractSummary({ rows, loading }) {
  const cards = useMemo(() => getSoftwareContractSummary(rows), [rows]);
  return (
    <div className="contract-summary-grid" aria-label="軟體合約統計摘要">
      {cards.map((card) => (
        <article className={`contract-summary-card ${card.tone === "warning" ? "is-warning" : ""}`} key={card.title}>
          <div>
            <span>{card.title}</span>
            <strong>{loading ? "..." : card.value}</strong>
          </div>
          <p>{card.tone === "warning" ? "!" : ""}{card.helper}</p>
        </article>
      ))}
    </div>
  );
}

export default function DataSectionPage({ sectionKey }) {
  const config = DATA_SECTION_CONFIGS[sectionKey];
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
      const data = await api(`/api/records?source=${encodeURIComponent(config.source)}`);
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuery("");
    setDepartment("全部");
    load();
  }, [config?.source]);

  const departments = useMemo(() => {
    if (config?.source !== "contacts") return [];
    const values = rows
      .map((row) => String(getRecordField(row.data, { keys: ["單位"] }) || "").trim())
      .filter(Boolean);
    return ["全部", ...Array.from(new Set(values))];
  }, [config?.source, rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchDepartment = config?.source !== "contacts" || department === "全部" || getRecordField(row.data, { keys: ["單位"] }) === department;
      const matchKeyword = !keyword || JSON.stringify(row.data || {}).toLowerCase().includes(keyword);
      return matchDepartment && matchKeyword;
    });
  }, [rows, query, department, config?.source]);

  const columns = useMemo(() => RECORD_COLUMN_CONFIGS[config?.source] || [], [config?.source]);

  if (!config) {
    return (
      <section className="section-page">
        <div className="empty">找不到此資料分頁。</div>
      </section>
    );
  }

  return (
    <section className="section-page">
      <header className="section-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.hint}。若目前是空的，請先執行 Sheet 匯入 Supabase。</p>
        </div>
        <div className="section-actions">
          <button onClick={load}>刷新</button>
        </div>
      </header>
      {error ? <div className="error-box">{error}</div> : null}
      {config.source === "contracts_software" ? <SoftwareContractSummary rows={rows} loading={loading} /> : null}
      <div className="records-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋這個分頁..." />
        <span>{loading ? "讀取中..." : `${filteredRows.length} 筆`}</span>
      </div>
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
      <div className="records-table">
        {loading ? (
          <div className="empty">讀取資料中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty">目前沒有資料。請先建立 sheet_records 並執行匯入。</div>
        ) : (
          <>
            <div className={`record-row record-head ${config.source === "contracts_mobile" ? "mobile-contract-row" : ""}`}>
              {columns.map((column) => <span key={column.label}>{column.label}</span>)}
            </div>
            {filteredRows.map((row) => (
              <div className={`record-row ${config.source === "contracts_mobile" ? "mobile-contract-row" : ""}`} key={row.id || row.record_key}>
                {columns.map((column) => (
                  <RecordValue key={column.label} value={getRecordField(row.data, column)} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
