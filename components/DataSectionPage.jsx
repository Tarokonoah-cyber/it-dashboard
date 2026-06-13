"use client";

import { useEffect, useMemo, useState } from "react";

const DATA_SECTION_CONFIGS = {
  contacts: { title: "通訊錄", source: "contacts", hint: "原 Sheet：通訊錄" },
  anydesk: { title: "AnyDesk List", source: "anydesk", hint: "原 Sheet：ANYDESK LIST" }
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
  ]
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
            <div className="record-row record-head">
              {columns.map((column) => <span key={column.label}>{column.label}</span>)}
            </div>
            {filteredRows.map((row) => (
              <div className="record-row" key={row.id || row.record_key}>
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
