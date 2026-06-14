"use client";

import { useEffect, useMemo, useState } from "react";

const MOUNTAIN_PC_CONFIG = {
  title: "山上電腦",
  source: "assets_mountain_pc",
  hint: "設備清單：山上電腦"
};

const MOUNTAIN_PC_COLUMNS = [
  { label: "資產類型", keys: ["資產類型"] },
  { label: "電腦名稱", keys: ["電腦名稱", "設備名稱"] },
  { label: "部門", keys: ["部門"] },
  { label: "使用人", keys: ["使用人"] },
  { label: "IP位置", keys: ["IP位置"], sortable: true },
  { label: "主機型號", keys: ["主機型號", "設備型號", "型號"] },
  { label: "螢幕型號", keys: ["螢幕型號", "monitor_model"] },
  { label: "Windows版本", keys: ["WINDOWS版本", "Windows版本", "windows_version"] },
  { label: "防毒", keys: ["是否裝防毒", "防毒"] },
  { label: "盤點狀態", keys: ["盤點狀態", "狀態"] },
  { label: "備註", keys: ["備註", "盤點備註"] },
  { label: "最後更新", keys: ["最後更新", "盤點時間"] }
];

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

function dateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDate(value) {
  return dateKey(value) || "-";
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

function normalizeWindowsFilter(value) {
  const text = String(value || "").toLowerCase().replace(/\s+/g, "");
  if (text.includes("11")) return "Win11";
  if (text.includes("10")) return "Win10";
  return "";
}

function ipParts(value) {
  const parts = String(value || "")
    .trim()
    .split(".")
    .map((part) => Number(part));
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : [999, 999, 999, 999];
}

function compareIpValues(left, right, direction) {
  const leftParts = ipParts(left);
  const rightParts = ipParts(right);
  for (let index = 0; index < 4; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return (leftParts[index] - rightParts[index]) * direction;
    }
  }
  return 0;
}

function assetValue(row, column) {
  return getRecordField(row.data || {}, column);
}

function AntivirusValue({ value }) {
  const text = String(value || "").trim();
  if (!text || text === "-") return <span className="muted">-</span>;
  const installed = /已|是|安裝|yes|true|installed|有/i.test(text) && !/未|no|false|none|無/i.test(text);
  return (
    <span className={`antivirus-state ${installed ? "installed" : "missing"}`}>
      <i aria-hidden="true">◆</i>
      {installed ? "已安裝" : "未安裝"}
    </span>
  );
}

function InventoryStatusBadge({ value }) {
  const text = String(value || "").trim();
  if (!text) return <span className="muted">-</span>;
  let tone = "pending";
  if (text.includes("已")) tone = "done";
  if (text.includes("未") || text.includes("異常")) tone = "danger";
  if (text.includes("待")) tone = "pending";
  return <span className={`inventory-badge ${tone}`}>{text}</span>;
}

function AssetCell({ column, value }) {
  if (column.label === "防毒") return <AntivirusValue value={value} />;
  if (column.label === "盤點狀態") return <InventoryStatusBadge value={value} />;
  if (column.label === "最後更新") return <RecordValue value={formatDate(value)} />;
  if (column.label === "資產類型") {
    return (
      <span className="asset-type-pill">
        <i aria-hidden="true">▣</i>
        {value || "-"}
      </span>
    );
  }
  return <RecordValue value={value} />;
}

export default function MountainComputerPage({ config = MOUNTAIN_PC_CONFIG }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("全部部門");
  const [windowsFilter, setWindowsFilter] = useState("全部");
  const [ipSort, setIpSort] = useState("asc");

  async function load() {
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
    load();
  }, [config.source]);

  const departments = useMemo(() => {
    const values = rows
      .map((row) => String(assetValue(row, { keys: ["部門"] }) || "").trim())
      .filter(Boolean);
    return ["全部部門", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-Hant"))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const direction = ipSort === "asc" ? 1 : -1;
    return rows
      .filter((row) => {
        const data = row.data || {};
        const matchDepartment = department === "全部部門" || assetValue(row, { keys: ["部門"] }) === department;
        const windowsValue = normalizeWindowsFilter(assetValue(row, { keys: ["WINDOWS版本", "Windows版本", "windows_version"] }));
        const matchWindows = windowsFilter === "全部" || windowsValue === windowsFilter;
        const matchKeyword =
          !keyword ||
          [
            "資產類型",
            "電腦名稱",
            "設備名稱",
            "部門",
            "使用人",
            "IP位置",
            "主機型號",
            "設備型號",
            "型號",
            "螢幕型號",
            "WINDOWS版本",
            "備註",
            "盤點備註"
          ].some((key) => String(data[key] || "").toLowerCase().includes(keyword));
        return matchDepartment && matchWindows && matchKeyword;
      })
      .sort((left, right) =>
        compareIpValues(assetValue(left, { keys: ["IP位置"] }), assetValue(right, { keys: ["IP位置"] }), direction)
      );
  }, [rows, query, department, windowsFilter, ipSort]);

  function resetFilters() {
    setQuery("");
    setDepartment("全部部門");
    setWindowsFilter("全部");
    setIpSort("asc");
  }

  return (
    <section className="section-page mountain-pc-page">
      <header className="asset-page-head">
        <div>
          <div className="breadcrumb">資產管理 / 山上電腦</div>
          <div className="asset-title-row">
            <h1>{config.title}</h1>
            <span className="count-badge">{loading ? "讀取中" : `${rows.length} 筆`}</span>
          </div>
        </div>
        <button onClick={load}>刷新</button>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="asset-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋部門、使用人、IP、電腦名稱、主機型號、螢幕型號或備註..."
        />
        <select value={department} onChange={(event) => setDepartment(event.target.value)}>
          {departments.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div className="segmented-control" aria-label="Windows 快速篩選">
          {["全部", "Win10", "Win11"].map((item) => (
            <button
              key={item}
              type="button"
              className={windowsFilter === item ? "active" : ""}
              onClick={() => setWindowsFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <button className="plain-reset" onClick={resetFilters}>重置</button>
      </div>

      <div className="asset-table-wrap">
        <table className="asset-table">
          <thead>
            <tr>
              {MOUNTAIN_PC_COLUMNS.map((column) => (
                <th key={column.label}>
                  {column.sortable ? (
                    <button className="ip-sort-button" type="button" onClick={() => setIpSort((value) => (value === "asc" ? "desc" : "asc"))}>
                      IP位置 {ipSort === "asc" ? "↑" : "↓"}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={MOUNTAIN_PC_COLUMNS.length}>讀取設備資料中...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={MOUNTAIN_PC_COLUMNS.length}>目前沒有符合條件的設備資料。</td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id || row.record_key}>
                  {MOUNTAIN_PC_COLUMNS.map((column) => (
                    <td key={column.label}>
                      <AssetCell column={column} value={assetValue(row, column)} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
