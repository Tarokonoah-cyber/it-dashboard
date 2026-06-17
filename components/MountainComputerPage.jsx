"use client";

import { useEffect, useMemo, useState } from "react";
import { getField } from "./DataSectionPage";

const MOUNTAIN_PC_CONFIG = {
  title: "山上電腦",
  source: "assets_mountain_pc",
  hint: "設備清單 / 山上電腦"
};

const MOUNTAIN_PC_COLUMNS = [
  { label: "資產類型", keys: ["資產類型", "asset_type", "鞈憿?", "è³ç¢é¡å"] },
  { label: "電腦名稱", keys: ["電腦名稱", "設備名稱", "asset_name", "computer_name", "?餉?迂", "閮剖??迂", "é»è\u0085¦åç¨±", "è¨­ååç¨±"] },
  { label: "部門", keys: ["部門", "department", "?券?", "é¨é"] },
  { label: "使用者", keys: ["使用者", "使用人", "user_name", "雿輻鈭?", "ä½¿ç¨äºº"] },
  { label: "IP 位址", keys: ["IP", "IP 位址", "ip_address", "IP雿蔭", "IPä½ç½®"], sortable: true },
  { label: "主機型號", keys: ["主機型號", "model", "銝餅???", "閮剖???", "??", "ä¸»æ©åè", "è¨­ååè", "åè"] },
  { label: "螢幕型號", keys: ["螢幕型號", "monitor_model", "?Ｗ???", "è¢å¹åè"] },
  { label: "Windows 版本", keys: ["Windows 版本", "windows_version", "WINDOWS?", "Windows?", "WINDOWSçæ¬"] },
  { label: "防毒狀態", keys: ["防毒", "antivirus_installed", "?臬鋆瘥?", "?脫?", "æ¯å¦è£é²æ¯"] },
  { label: "盤點狀態", keys: ["盤點狀態", "狀態", "status", "?日????", "???", "ç¤é»çæ\u0085", "çæ\u0085"] },
  { label: "備註", keys: ["備註", "note", "?酉", "?日??酉", "åè¨»", "ç¤é»åè¨»"] },
  { label: "最後更新", keys: ["最後更新", "updated_at", "?敺??", "?日???", "æå¾æ´æ°"] }
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
  if (typeof value === "object") return <span title={JSON.stringify(value)}>{JSON.stringify(value)}</span>;
  return <span title={String(value)}>{String(value)}</span>;
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
  return getField(row, column.keys, "");
}

function AntivirusValue({ value }) {
  const text = String(value || "").trim();
  if (!text || text === "-") return <span className="muted">-</span>;
  const installed = /yes|true|installed|有|已|啟用|正常/i.test(text) && !/no|false|none|無|未/i.test(text);
  return (
    <span className={`antivirus-state ${installed ? "installed" : "missing"}`}>
      <i aria-hidden="true">{installed ? "●" : "!"}</i>
      {installed ? "已安裝" : "需確認"}
    </span>
  );
}

function InventoryStatusBadge({ value }) {
  const text = String(value || "").trim();
  if (!text) return <span className="muted">-</span>;
  let tone = "pending";
  if (text.includes("完成") || text.includes("已") || text.toLowerCase().includes("done")) tone = "done";
  if (text.includes("異常") || text.includes("缺") || text.toLowerCase().includes("error")) tone = "danger";
  return <span className={`inventory-badge ${tone}`}>{text}</span>;
}

function AssetCell({ column, value }) {
  if (column.label === "防毒狀態") return <AntivirusValue value={value} />;
  if (column.label === "盤點狀態") return <InventoryStatusBadge value={value} />;
  if (column.label === "最後更新") return <RecordValue value={formatDate(value)} />;
  if (column.label === "資產類型") {
    return (
      <span className="asset-type-pill">
        <i aria-hidden="true">●</i>
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
      .map((row) => String(assetValue(row, { keys: ["部門", "department", "?券?", "é¨é"] }) || "").trim())
      .filter(Boolean);
    return ["全部部門", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-Hant"))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const direction = ipSort === "asc" ? 1 : -1;
    return rows
      .filter((row) => {
        const data = row.data || {};
        const matchDepartment = department === "全部部門" || assetValue(row, { keys: ["部門", "department", "?券?", "é¨é"] }) === department;
        const windowsValue = normalizeWindowsFilter(assetValue(row, { keys: ["Windows 版本", "WINDOWS?", "Windows?", "windows_version", "WINDOWSçæ¬"] }));
        const matchWindows = windowsFilter === "全部" || windowsValue === windowsFilter;
        const matchKeyword =
          !keyword ||
          MOUNTAIN_PC_COLUMNS.some((column) => String(getField({ data }, column.keys, "")).toLowerCase().includes(keyword));
        return matchDepartment && matchWindows && matchKeyword;
      })
      .sort((left, right) =>
        compareIpValues(assetValue(left, { keys: ["IP", "IP 位址", "ip_address", "IP雿蔭", "IPä½ç½®"] }), assetValue(right, { keys: ["IP", "IP 位址", "ip_address", "IP雿蔭", "IPä½ç½®"] }), direction)
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
          <div className="breadcrumb">設備清單 / 山上電腦</div>
          <div className="asset-title-row">
            <span className="count-badge">{loading ? "讀取中" : `${rows.length} 筆`}</span>
          </div>
          <p>{config.hint}</p>
        </div>
        <button onClick={load}>重新整理</button>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="asset-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋部門、使用者、電腦名稱、IP、型號或備註..."
        />
        <select value={department} onChange={(event) => setDepartment(event.target.value)}>
          {departments.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div className="segmented-control" aria-label="Windows 版本篩選">
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
        <button className="plain-reset" onClick={resetFilters}>重設</button>
      </div>

      <div className="asset-table-wrap">
        <table className="asset-table">
          <thead>
            <tr>
              {MOUNTAIN_PC_COLUMNS.map((column) => (
                <th key={column.label}>
                  {column.sortable ? (
                    <button className="ip-sort-button" type="button" onClick={() => setIpSort((value) => (value === "asc" ? "desc" : "asc"))}>
                      IP 位址 {ipSort === "asc" ? "升冪" : "降冪"}
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
                <td colSpan={MOUNTAIN_PC_COLUMNS.length}>目前沒有符合條件的設備資料</td>
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
