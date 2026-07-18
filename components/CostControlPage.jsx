"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMPTY_DATA = {
  setupRequired: false,
  permissions: { canImport: true, fixedDepartment: null, roleSystem: false, basis: "dashboard-auth" },
  options: { years: [], departments: [], months: Array.from({ length: 12 }, (_, index) => index + 1) },
  items: [], vouchers: [], monthlyAmounts: [], trend: [], imports: [], sourceSheets: []
};
const PAGE_SIZE = 10;

function currency(value) {
  if (value === null || value === undefined || value === "") return "未提供";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function percent(value) {
  return value === null || value === undefined ? "無法計算" : `${Number(value).toFixed(1)}%`;
}

function localTime(value) {
  if (!value) return "尚無正式匯入";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(date)
    : String(value);
}

async function api(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.message || "成本控制資料處理失敗");
  return payload.data;
}

function StatusBadge({ status }) {
  const safe = status || { key: "normal", label: "正常", icon: "✓" };
  return <span className={`cc-status is-${safe.key}`}><span aria-hidden="true">{safe.icon}</span>{safe.label}</span>;
}

function FilterField({ label, children }) {
  return <label className="cc-filter"><span>{label}</span>{children}</label>;
}

function SummaryCard({ label, value, hint, tone = "default", children }) {
  return (
    <article className={`cc-summary-card is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
      {children}
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="cc-skeleton" aria-label="成本控制資料讀取中" aria-busy="true">
      <div className="cc-skeleton-line wide" />
      <div className="cc-skeleton-grid">{Array.from({ length: 5 }, (_, index) => <div className="cc-skeleton-card" key={index} />)}</div>
      <div className="cc-skeleton-panel" />
      <div className="cc-skeleton-panel tall" />
    </div>
  );
}

function TrendChart({ rows }) {
  const [metric, setMetric] = useState("monthly");
  const labels = { monthly: "每月請款", cumulative: "累計動支", available: "可用餘額變化" };
  const values = rows.map((row) => Number(row[metric] || 0));
  const ceiling = Math.max(1, ...values.map((value) => Math.abs(value)));
  const nonZero = rows.filter((row) => Number(row[metric] || 0) !== 0);
  const peak = rows.reduce((current, row) => Math.abs(Number(row[metric] || 0)) > Math.abs(Number(current?.[metric] || 0)) ? row : current, null);

  return (
    <section className="cc-panel cc-trend-panel" aria-labelledby="cc-trend-title">
      <header className="cc-panel-head">
        <div><span>MONTHLY TREND</span><h2 id="cc-trend-title">每月動支趨勢</h2></div>
        <div className="cc-segmented" role="group" aria-label="圖表指標">
          {Object.entries(labels).map(([key, label]) => (
            <button key={key} type="button" className={metric === key ? "active" : ""} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</button>
          ))}
        </div>
      </header>
      <div className="cc-chart" role="img" aria-label={`${rows[0]?.year || "目前年度"} 年 ${labels[metric]}柱狀圖`}>
        {rows.map((row) => {
          const value = Number(row[metric] || 0);
          const height = Math.max(value === 0 ? 2 : 8, (Math.abs(value) / ceiling) * 100);
          return (
            <div className="cc-chart-column" key={`${row.year}-${row.month}`}>
              <button
                type="button"
                className={`cc-chart-bar ${value < 0 ? "negative" : ""}`}
                style={{ "--cc-bar-height": `${height}%` }}
                title={`${row.year} 年 ${row.month} 月：${currency(value)}`}
                aria-label={`${row.year} 年 ${row.month} 月${labels[metric]} ${currency(value)}`}
              ><span /></button>
              <small>{row.month}月</small>
            </div>
          );
        })}
      </div>
      <p className="cc-chart-summary">
        圖表文字摘要：{nonZero.length ? `${nonZero.length} 個月份有金額；最高絕對值為 ${peak?.month || "-"} 月 ${currency(peak?.[metric] || 0)}。` : "目前 1 月至 12 月皆為 0。"}
        空月份保留為 0；跨年度資料依實際請款年月保存。
      </p>
    </section>
  );
}

function ItemDrawer({ item, monthlyAmounts, vouchers, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.body.classList.add("cc-drawer-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("cc-drawer-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const amount = monthlyAmounts.filter((entry) => entry.budget_item_id === item.id && Number(entry.actual_month) === month)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    return { month, amount };
  });
  const related = vouchers.filter((voucher) => voucher.relationshipStatus === "exact" && voucher.budgetCode === item.budgetCode);

  return (
    <div className="cc-drawer-backdrop" onMouseDown={onClose}>
      <aside className="cc-drawer" role="dialog" aria-modal="true" aria-labelledby="cc-drawer-title" tabIndex={-1} ref={dialogRef} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>預算項目明細</span><h2 id="cc-drawer-title">{item.itemName}</h2></div>
          <button type="button" onClick={onClose} aria-label="關閉預算項目明細">×</button>
        </header>
        <div className="cc-drawer-body">
          <dl className="cc-detail-grid">
            <div><dt>預算編號</dt><dd>{item.budgetCode || "未提供"}</dd></div>
            <div><dt>部門</dt><dd>{item.department}</dd></div>
            <div><dt>預算年度</dt><dd>{item.budgetYear}</dd></div>
            <div><dt>預算金額</dt><dd>{currency(item.budgetAmount)}</dd></div>
            <div><dt>累計動支</dt><dd>{currency(item.actualAmount)}</dd></div>
            <div><dt>送簽中</dt><dd>{currency(item.committedAmount)}</dd></div>
            <div><dt>可用餘額</dt><dd className={item.availableAmount < 0 ? "danger" : ""}>{currency(item.availableAmount)}</dd></div>
            <div><dt>執行率</dt><dd>{percent(item.executionRate)}</dd></div>
          </dl>
          <section className="cc-drawer-section">
            <h3>各月份動支金額</h3>
            <div className="cc-month-grid">{months.map((month) => <div key={month.month}><span>{month.month}月</span><strong>{currency(month.amount)}</strong></div>)}</div>
          </section>
          <section className="cc-drawer-section">
            <h3>相關傳票</h3>
            {related.length ? related.map((voucher) => (
              <article className="cc-related-voucher" key={voucher.id}>
                <div><strong>{voucher.voucherNumber || "未提供傳票號碼"}</strong><span>{voucher.requestDate || "日期未提供"}</span></div>
                <p>{voucher.description || "無說明"}</p><b>{currency(voucher.amount)}</b>
              </article>
            )) : <div className="cc-data-note">目前來源資料未提供預算編號，無法建立精確的傳票關聯。</div>}
          </section>
          <p className="cc-source-note">來源：{item.sourceSheetName}，第 {item.sourceRowNumber} 列</p>
        </div>
      </aside>
    </div>
  );
}

function BudgetItemsTab({ data, onOpen }) {
  const [filters, setFilters] = useState({ code: "", name: "", department: "", status: "" });
  const [sort, setSort] = useState({ key: "budgetCode", direction: "asc" });
  const [page, setPage] = useState(1);
  const rows = useMemo(() => {
    const code = filters.code.trim().toLowerCase();
    const name = filters.name.trim().toLowerCase();
    return data.items.filter((item) =>
      (!code || String(item.budgetCode || "").toLowerCase().includes(code)) &&
      (!name || String(item.itemName || "").toLowerCase().includes(name)) &&
      (!filters.department || item.department === filters.department) &&
      (!filters.status || item.status.key === filters.status)
    ).sort((left, right) => {
      const a = left[sort.key] ?? "";
      const b = right[sort.key] ?? "";
      const comparison = typeof a === "number" || typeof b === "number" ? Number(a) - Number(b) : String(a).localeCompare(String(b), "zh-Hant", { numeric: true });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [data.items, filters, sort]);
  useEffect(() => setPage(1), [filters, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function changeSort(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  }

  return (
    <section className="cc-tab-panel" role="tabpanel" aria-labelledby="cc-tab-items">
      <div className="cc-table-tools">
        <FilterField label="預算編號搜尋"><input value={filters.code} onChange={(event) => setFilters((current) => ({ ...current, code: event.target.value }))} placeholder="例如 A26-MIS001" /></FilterField>
        <FilterField label="項目名稱搜尋"><input value={filters.name} onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} placeholder="輸入項目關鍵字" /></FilterField>
        <FilterField label="部門"><select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="">全部部門</option>{data.options.departments.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <FilterField label="狀態"><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">全部狀態</option><option value="normal">正常</option><option value="attention">注意</option><option value="near">接近用罄</option><option value="over">超支</option></select></FilterField>
      </div>
      {!rows.length ? <div className="cc-empty">沒有符合搜尋條件的預算項目。</div> : (
        <>
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead><tr>
                <th><button type="button" onClick={() => changeSort("budgetCode")}>預算編號</button></th>
                <th><button type="button" onClick={() => changeSort("itemName")}>預算項目</button></th>
                <th className="number"><button type="button" onClick={() => changeSort("budgetAmount")}>預算金額</button></th>
                <th className="number"><button type="button" onClick={() => changeSort("actualAmount")}>已動支</button></th>
                <th className="number">送簽中</th><th className="number">可用餘額</th>
                <th className="number"><button type="button" onClick={() => changeSort("executionRate")}>執行率</button></th><th>狀態</th>
              </tr></thead>
              <tbody>{visible.map((item) => <tr key={item.id} tabIndex={0} onClick={() => onOpen(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(item); }}>
                <td><button className="cc-item-link" type="button" onClick={(event) => { event.stopPropagation(); onOpen(item); }}>{item.budgetCode || "未提供"}</button></td>
                <td><strong>{item.itemName}</strong><small>{item.department}</small></td>
                <td className="number">{currency(item.budgetAmount)}</td><td className="number">{currency(item.actualAmount)}</td><td className="number">{currency(item.committedAmount)}</td>
                <td className={`number ${item.availableAmount < 0 ? "danger" : ""}`}>{currency(item.availableAmount)}</td><td className="number">{percent(item.executionRate)}</td><td><StatusBadge status={item.status} /></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="cc-mobile-list">{visible.map((item) => <button type="button" className="cc-mobile-card" key={item.id} onClick={() => onOpen(item)}><div><strong>{item.budgetCode || "未提供"}</strong><StatusBadge status={item.status} /></div><h3>{item.itemName}</h3><p>{item.department}</p><dl><div><dt>預算</dt><dd>{currency(item.budgetAmount)}</dd></div><div><dt>動支</dt><dd>{currency(item.actualAmount)}</dd></div><div><dt>餘額</dt><dd className={item.availableAmount < 0 ? "danger" : ""}>{currency(item.availableAmount)}</dd></div></dl></button>)}</div>
          <Pagination page={page} pages={pages} total={rows.length} onChange={setPage} />
        </>
      )}
    </section>
  );
}

function Pagination({ page, pages, total, onChange }) {
  return <div className="cc-pagination"><span>共 {total} 筆，第 {page}／{pages} 頁</span><div><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一頁</button><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>下一頁</button></div></div>;
}

function VouchersTab({ data, queryString }) {
  const [filters, setFilters] = useState({ number: "", description: "", account: "", month: "", department: "", min: "", max: "" });
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => data.vouchers.filter((item) => {
    const number = filters.number.trim().toLowerCase();
    const description = filters.description.trim().toLowerCase();
    const amount = Number(item.amount || 0);
    return (!number || String(item.voucherNumber || "").toLowerCase().includes(number)) &&
      (!description || String(item.description || "").toLowerCase().includes(description)) &&
      (!filters.account || item.accountCode === filters.account) &&
      (!filters.month || Number(item.actualMonth) === Number(filters.month)) &&
      (!filters.department || item.department === filters.department) &&
      (filters.min === "" || amount >= Number(filters.min)) && (filters.max === "" || amount <= Number(filters.max));
  }).sort((a, b) => {
    if (sort === "amount-desc") return Number(b.amount) - Number(a.amount);
    if (sort === "amount-asc") return Number(a.amount) - Number(b.amount);
    const value = String(a.requestDate || "").localeCompare(String(b.requestDate || ""));
    return sort === "date-asc" ? value : -value;
  }), [data.vouchers, filters, sort]);
  useEffect(() => setPage(1), [filters, sort]);
  const accounts = [...new Set(data.vouchers.map((item) => item.accountCode).filter(Boolean))].sort();
  const departments = [...new Set(data.vouchers.map((item) => item.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="cc-tab-panel" role="tabpanel" aria-labelledby="cc-tab-vouchers">
      <div className="cc-tab-actions"><p>缺少來源欄位時保留空值；未提供預算編號的傳票不做文字相似度關聯。</p><a className="cc-export" href={`/api/cost-control/export?${queryString}&type=vouchers`}>匯出 CSV</a></div>
      <div className="cc-table-tools vouchers">
        <FilterField label="傳票號碼"><input value={filters.number} onChange={(event) => setFilters((current) => ({ ...current, number: event.target.value }))} /></FilterField>
        <FilterField label="說明關鍵字"><input value={filters.description} onChange={(event) => setFilters((current) => ({ ...current, description: event.target.value }))} /></FilterField>
        <FilterField label="科目"><select value={filters.account} onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value }))}><option value="">全部科目</option>{accounts.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <FilterField label="月份"><select value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}><option value="">全部月份</option>{data.options.months.map((month) => <option key={month} value={month}>{month}月</option>)}</select></FilterField>
        <FilterField label="部門"><select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="">全部部門</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <FilterField label="最低金額"><input type="number" value={filters.min} onChange={(event) => setFilters((current) => ({ ...current, min: event.target.value }))} /></FilterField>
        <FilterField label="最高金額"><input type="number" value={filters.max} onChange={(event) => setFilters((current) => ({ ...current, max: event.target.value }))} /></FilterField>
        <FilterField label="排序"><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date-desc">日期新到舊</option><option value="date-asc">日期舊到新</option><option value="amount-desc">金額高到低</option><option value="amount-asc">金額低到高</option></select></FilterField>
      </div>
      {!rows.length ? <div className="cc-empty">沒有符合搜尋條件的傳票明細。</div> : <>
        <div className="cc-table-wrap"><table className="cc-table vouchers"><thead><tr><th>傳票號碼</th><th>請款日期</th><th>科目代碼</th><th>科目名稱</th><th>說明</th><th className="number">金額</th><th>部門</th><th>預算編號</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td>{item.voucherNumber || "未提供"}</td><td>{item.requestDate || "未提供"}</td><td>{item.accountCode || "未提供"}</td><td>{item.accountName || "未提供"}</td><td>{item.description || "未提供"}</td><td className="number">{currency(item.amount)}</td><td>{item.department || "未提供"}</td><td>{item.budgetCode || <span className="cc-unlinked">未關聯</span>}</td></tr>)}</tbody></table></div>
        <div className="cc-mobile-list">{visible.map((item) => <article className="cc-mobile-card static" key={item.id}><div><strong>{item.voucherNumber || "未提供傳票號碼"}</strong><span>{item.requestDate || "日期未提供"}</span></div><h3>{item.description || "未提供說明"}</h3><p>{item.accountCode || "未提供科目"} · {item.department || "未提供部門"}</p><b>{currency(item.amount)}</b></article>)}</div>
        <Pagination page={page} pages={pages} total={rows.length} onChange={setPage} />
      </>}
    </section>
  );
}

function HistoryTab({ data, selectedYear, onYearChange }) {
  return (
    <section className="cc-tab-panel" role="tabpanel" aria-labelledby="cc-tab-history">
      <div className="cc-history-controls">
        <FilterField label="預算年度"><select value={selectedYear || ""} onChange={(event) => onYearChange(event.target.value)}>{data.options.years.map((year) => <option key={year} value={year}>{year} 年</option>)}</select></FilterField>
        <div><span>資料來源工作表</span><strong>{data.sourceSheets.length ? data.sourceSheets.join("、") : "未提供"}</strong></div>
      </div>
      <div className="cc-history-summary">
        <SummaryCard label="年度預算" value={currency(data.summary?.budget || 0)} />
        <SummaryCard label="累計動支" value={currency(data.summary?.actual || 0)} />
        <SummaryCard label="可用餘額" value={currency(data.summary?.available || 0)} tone={(data.summary?.available || 0) < 0 ? "danger" : "default"} />
        <SummaryCard label="預算項目數" value={`${data.items.length} 項`} />
      </div>
      {!data.items.length ? <div className="cc-empty">此年度尚無可辨識的預算項目。</div> : <div className="cc-history-list">{data.items.map((item) => <article key={item.id}><div><strong>{item.budgetCode}</strong><StatusBadge status={item.status} /></div><h3>{item.itemName}</h3><p>{item.department} · {item.sourceSheetName}</p><dl><div><dt>預算</dt><dd>{currency(item.budgetAmount)}</dd></div><div><dt>動支</dt><dd>{currency(item.actualAmount)}</dd></div><div><dt>餘額</dt><dd>{currency(item.availableAmount)}</dd></div></dl></article>)}</div>}
    </section>
  );
}

function ImportDialog({ onClose, onImported }) {
  const dialogRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialogRef.current?.focus();
    function keydown(event) { if (event.key === "Escape" && !loading) onClose(); }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [loading, onClose]);

  async function createPreview() {
    if (!file) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      const form = new FormData(); form.set("file", file);
      const result = await api("/api/cost-control/import/preview", { method: "POST", body: form });
      setPreview(result);
      setMode(result.existingPeriod ? "" : "new");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function confirm() {
    if (!preview?.previewId || !mode) return;
    setLoading(true); setError("");
    try {
      await api("/api/cost-control/import/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previewId: preview.previewId, mode }) });
      await onImported();
      onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="cc-modal-backdrop" onMouseDown={() => !loading && onClose()}>
      <section className="cc-import-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-import-title" tabIndex={-1} ref={dialogRef} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>SERVER-SIDE IMPORT</span><h2 id="cc-import-title">匯入 Cost Control Excel</h2></div><button type="button" aria-label="關閉匯入視窗" disabled={loading} onClick={onClose}>×</button></header>
        <div className="cc-import-body">
          <label className="cc-file-picker"><span>選擇 .xlsx 檔案（上限 15 MB）</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(""); }} /></label>
          <button className="primary" type="button" disabled={!file || loading} onClick={createPreview}>{loading && !preview ? "伺服器解析中…" : "解析並顯示預覽"}</button>
          {error ? <div className="cc-alert error" role="alert">{error}</div> : null}
          {preview ? <>
            <section className="cc-import-summary"><div><span>年度</span><strong>{preview.budgetYear || "未辨識"}</strong></div><div><span>月份</span><strong>{preview.dataMonth ? `${preview.dataMonth} 月` : "未辨識"}</strong></div><div><span>部門數</span><strong>{preview.counts.departments}</strong></div><div><span>預算項目</span><strong>{preview.counts.budgetItems}</strong></div><div><span>傳票筆數</span><strong>{preview.counts.vouchers}</strong></div><div><span>警告</span><strong>{preview.counts.warnings}</strong></div></section>
            <div className="cc-import-meta"><p><b>來源：</b>{preview.filename}</p><p><b>歷史資料工作表：</b>{preview.historySheetNames.join("、") || "無"}</p><p><b>辨識年度：</b>{preview.recognizedYears.join("、") || "無"}</p></div>
            {preview.existingPeriod ? <div className="cc-alert warning"><strong>已存在 {preview.budgetYear} 年 {preview.dataMonth} 月資料。</strong><span>請選擇取消、覆蓋現有資料，或另存為新的匯入版本。</span><div className="cc-import-modes"><button type="button" className={mode === "overwrite" ? "active" : ""} onClick={() => setMode("overwrite")}>覆蓋現有資料</button><button type="button" className={mode === "version" ? "active" : ""} onClick={() => setMode("version")}>另存新版本</button></div></div> : null}
            {preview.duplicateFiles?.length ? <div className="cc-alert warning">偵測到相同檔案雜湊曾成功匯入 {preview.duplicateFiles.length} 次，請確認是否仍要建立新版本。</div> : null}
            {preview.fatalErrors?.length ? <div className="cc-alert error">{preview.fatalErrors.join("；")}</div> : null}
            <details className="cc-import-details"><summary>工作表辨識結果（{preview.sheets.length}）</summary>{preview.sheets.map((sheet) => <div key={`${sheet.name}-${sheet.classification}`}><strong>{sheet.name}</strong><span>{sheet.classification} · {sheet.rows} 列 · 合併區 {sheet.mergedRanges} · 警告 {sheet.warnings}</span></div>)}</details>
            <details className="cc-import-details"><summary>資料品質警告（{preview.warnings.length}）</summary>{preview.warnings.slice(0, 100).map((warning, index) => <div key={`${warning.code}-${warning.sheet}-${warning.row}-${index}`}><strong>{warning.code}</strong><span>{warning.sheet}{warning.row ? ` 第 ${warning.row} 列` : ""}：{warning.message}</span></div>)}</details>
          </> : null}
        </div>
        <footer><button type="button" disabled={loading} onClick={onClose}>取消</button><button className="primary" type="button" disabled={!preview?.canImport || !mode || loading} onClick={confirm}>{loading && preview ? "交易寫入中…" : "確認匯入"}</button></footer>
      </section>
    </div>
  );
}

export default function CostControlPage() {
  const [data, setData] = useState(EMPTY_DATA);
  const [filters, setFilters] = useState({ year: "", department: "", month: "", scope: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("items");
  const [drawerItem, setDrawerItem] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const openerRef = useRef(null);
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.year) params.set("year", filters.year);
    if (filters.department) params.set("department", filters.department);
    if (filters.month) params.set("month", filters.month);
    if (filters.scope !== "all") params.set("scope", filters.scope);
    return params.toString();
  }, [filters]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData({ ...EMPTY_DATA, ...await api(`/api/cost-control?${queryString}`) }); }
    catch (err) { setError(err.message); setData(EMPTY_DATA); }
    finally { setLoading(false); }
  }, [queryString]);
  useEffect(() => { load(); }, [load]);
  function closeDrawer() { setDrawerItem(null); window.setTimeout(() => openerRef.current?.focus?.(), 0); }
  function openDrawer(item) { openerRef.current = document.activeElement; setDrawerItem(item); }
  const summary = data.summary;
  const displayYear = filters.year || data.selection?.year || data.meta?.dataYear;
  const displayMonth = filters.month || data.selection?.throughMonth || data.meta?.dataMonth;

  return (
    <section className="cc-page">
      <header className="cc-hero">
        <div className="cc-title"><span>COST CONTROL</span><h1>成本控制</h1><p>{displayYear ? `${displayYear} 年截至 ${displayMonth || "-"} 月` : "尚無正式匯入資料"}</p></div>
        <dl className="cc-import-info"><div><dt>最後匯入</dt><dd>{localTime(data.meta?.lastImportedAt)}</dd></div><div><dt>來源檔案</dt><dd title={data.meta?.filename}>{data.meta?.filename || "尚未提供"}</dd></div></dl>
        {data.permissions?.canImport ? <button className="primary cc-import-button" type="button" onClick={() => setImportOpen(true)}>匯入 Excel</button> : <span className="cc-permission-note">目前帳號只有檢視權限</span>}
      </header>

      <section className="cc-top-filters" aria-label="成本控制篩選">
        <FilterField label="預算年度"><select value={filters.year || data.selection?.year || ""} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}><option value="" disabled>選擇年度</option>{data.options.years.map((year) => <option key={year} value={year}>{year} 年</option>)}</select></FilterField>
        <FilterField label="部門"><select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="">全部部門</option>{data.options.departments.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <FilterField label="截至月份"><select value={filters.month || data.selection?.throughMonth || ""} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}><option value="" disabled>選擇月份</option>{data.options.months.map((month) => <option key={month} value={month}>{month} 月</option>)}</select></FilterField>
        <FilterField label="顯示範圍"><select value={filters.scope} onChange={(event) => setFilters((current) => ({ ...current, scope: event.target.value }))}><option value="all">全部</option><option value="used">有動支</option><option value="near">即將超支</option><option value="over">已超支</option></select></FilterField>
        <button type="button" onClick={() => setFilters({ year: "", department: data.permissions?.fixedDepartment || "", month: "", scope: "all" })}>清除條件</button>
      </section>

      {error ? <div className="cc-alert error" role="alert">{error}<button type="button" onClick={load}>重試</button></div> : null}
      {data.setupRequired ? <div className="cc-alert warning" role="status"><strong>本機程式已就緒，資料表尚未建立</strong><span>{data.message}</span></div> : null}
      {!data.permissions?.roleSystem ? <p className="cc-auth-note">目前專案沒有角色或帳號部門模型；部門預設保留「全部」，匯入 API 已集中在可替換的權限檢查介面。</p> : null}
      {loading ? <LoadingSkeleton /> : <>
        {!summary ? <div className="cc-empty prominent"><strong>目前沒有成本控制資料</strong><span>請由具匯入權限的使用者上傳 Cost Control .xlsx，預覽確認後才會寫入正式資料。</span></div> : <>
          <section className="cc-summary-grid" aria-label="成本控制總覽">
            <SummaryCard label="年度預算" value={currency(summary.budget)} hint={`${data.items.length} 個預算項目`} />
            <SummaryCard label="累計動支" value={currency(summary.actual)} />
            <SummaryCard label="送簽中" value={currency(summary.committed)} />
            <SummaryCard label="可用餘額" value={currency(summary.available)} tone={summary.available < 0 ? "danger" : "default"} hint={summary.available < 0 ? "! 異常：餘額為負數" : "扣除動支與送簽中"} />
            <SummaryCard label="預算執行率" value={percent(summary.executionRate)} tone={summary.status?.key || "default"} hint={`${summary.status?.icon || ""} ${summary.status?.label || "無法計算"}`}>
              <div className="cc-progress" role="progressbar" aria-label="預算執行率" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Math.max(0, summary.executionRate || 0))}><span style={{ width: `${Math.min(100, Math.max(0, summary.executionRate || 0))}%` }} /></div>
            </SummaryCard>
          </section>
          <TrendChart rows={data.trend} />
          {data.meta?.warningCount ? <div className="cc-alert warning"><strong>此匯入版本有 {data.meta.warningCount} 個資料品質警告</strong><span>警告不會被靜默轉成 0；可在匯入紀錄與來源列號追查。</span></div> : null}
          <section className="cc-panel cc-tabs-panel">
            <div className="cc-tabs" role="tablist" aria-label="成本控制內容">
              <button id="cc-tab-items" role="tab" aria-selected={tab === "items"} className={tab === "items" ? "active" : ""} onClick={() => setTab("items")}>預算項目 <span>{data.items.length}</span></button>
              <button id="cc-tab-vouchers" role="tab" aria-selected={tab === "vouchers"} className={tab === "vouchers" ? "active" : ""} onClick={() => setTab("vouchers")}>傳票明細 <span>{data.vouchers.length}</span></button>
              <button id="cc-tab-history" role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>歷史資料</button>
            </div>
            {tab === "items" ? <BudgetItemsTab data={data} onOpen={openDrawer} /> : null}
            {tab === "vouchers" ? <VouchersTab data={data} queryString={queryString} /> : null}
            {tab === "history" ? <HistoryTab data={data} selectedYear={displayYear} onYearChange={(year) => setFilters((current) => ({ ...current, year }))} /> : null}
          </section>
        </>}
      </>}
      {drawerItem ? <ItemDrawer item={drawerItem} monthlyAmounts={data.monthlyAmounts} vouchers={data.vouchers} onClose={closeDrawer} /> : null}
      {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} onImported={load} /> : null}
    </section>
  );
}
