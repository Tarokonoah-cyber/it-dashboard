"use client";

import { useEffect, useMemo, useState } from "react";
import InspectionStatusBadge from "./InspectionStatusBadge";
import {
  INSPECTION_PERIODS,
  ITEM_STATUSES,
  calculateInspectionSummary,
  createTemplateItems,
  filterInspectionItems,
  getInspectionPeriod,
  needsIssueFields,
  normalizeInspectionStatus
} from "./inspectionTemplates";

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const error = new Error(data.message || "資料處理失敗");
    error.data = data.data;
    error.code = data.code;
    throw error;
  }
  return data.data;
}

function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeFormItem(item) {
  return {
    ...item,
    status: normalizeInspectionStatus(item.status),
    issue_description: item.issue_description || "",
    handling_status: item.handling_status || "未處理",
    handling_method: item.handling_method || "",
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    note: item.note || ""
  };
}

function payloadItems(items) {
  return items.map((item) => ({
    id: item.id,
    category: item.category,
    item_name: item.item_name,
    status: normalizeInspectionStatus(item.status),
    issue_description: item.issue_description || "",
    handling_status: item.handling_status || "未處理",
    handling_method: item.handling_method || "",
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    note: item.note || ""
  }));
}

function draftKey(recordId, date) {
  return `daily-inspection-draft:${recordId || date || "today"}`;
}

export default function QuickInspectionPanel({
  mode = "new",
  recordId = "",
  initialPeriod = "daily",
  drawer = false,
  onCancel,
  onSaved
}) {
  const isEdit = mode === "edit" && recordId;
  const [loading, setLoading] = useState(Boolean(isEdit));
  const [saving, setSaving] = useState(false);
  const [activePeriod, setActivePeriod] = useState(INSPECTION_PERIODS[initialPeriod] ? initialPeriod : "daily");
  const [showAttentionOnly, setShowAttentionOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    inspection_date: todayTaipei(),
    inspector_name: "Admin",
    note: "",
    items: createTemplateItems().map(normalizeFormItem)
  });

  const activeItems = useMemo(() => filterInspectionItems(form.items, activePeriod), [form.items, activePeriod]);
  const summary = useMemo(() => calculateInspectionSummary(payloadItems(activeItems)), [activeItems]);
  const visibleItems = showAttentionOnly
    ? activeItems.filter((item) => needsIssueFields(item.status))
    : activeItems;

  useEffect(() => {
    let active = true;

    async function loadRecord() {
      if (!isEdit) {
        const savedDraft = window.localStorage.getItem(draftKey("", todayTaipei()));
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            if (active && draft?.items?.length) {
              setForm({
                inspection_date: draft.inspection_date || todayTaipei(),
                inspector_name: draft.inspector_name || "Admin",
                note: draft.note || "",
                items: draft.items.map(normalizeFormItem)
              });
              setMessage("已載入尚未完成的本機草稿。");
            }
          } catch {
            window.localStorage.removeItem(draftKey("", todayTaipei()));
          }
        }
        return;
      }

      setLoading(true);
      setError("");
      try {
        const data = await api(`/api/inspections/${recordId}`);
        const record = data.record;
        if (!active) return;
        setForm({
          inspection_date: String(record.inspection_date || "").slice(0, 10),
          inspector_name: record.inspector_name || "Admin",
          note: record.note || "",
          items: (record.items || []).map(normalizeFormItem)
        });
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecord();
    return () => {
      active = false;
    };
  }, [isEdit, recordId]);

  function updateItem(index, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.status && !needsIssueFields(patch.status)) {
          next.issue_description = "";
          next.handling_method = "";
          next.handling_status = "未處理";
        }
        return next;
      })
    }));
  }

  function markAllNormal() {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        getInspectionPeriod(item) === activePeriod
          ? {
              ...item,
              status: "正常",
              issue_description: "",
              handling_status: "未處理",
              handling_method: ""
            }
          : item
      )
    }));
    setMessage(`已將${INSPECTION_PERIODS[activePeriod].title}項目標記為正常。`);
  }

  function clearAll() {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        getInspectionPeriod(item) === activePeriod
          ? {
              ...item,
              status: "未檢查",
              issue_description: "",
              handling_status: "未處理",
              handling_method: "",
              note: ""
            }
          : item
      )
    }));
    setMessage(`已清除${INSPECTION_PERIODS[activePeriod].title}內容。`);
  }

  function saveDraft() {
    window.localStorage.setItem(draftKey(recordId, form.inspection_date), JSON.stringify(form));
    setMessage("草稿已儲存在此瀏覽器。");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const body = {
        inspection_date: form.inspection_date,
        inspector_name: form.inspector_name,
        note: form.note,
        items: payloadItems(form.items)
      };
      const data = await api(isEdit ? `/api/inspections/${recordId}` : "/api/inspections", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(body)
      });
      window.localStorage.removeItem(draftKey(recordId, form.inspection_date));
      window.localStorage.removeItem(draftKey("", form.inspection_date));
      onSaved?.(data.record);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="quick-inspection-loading">讀取巡檢紀錄中...</div>;
  }

  return (
    <form className={`quick-inspection-panel ${drawer ? "as-drawer" : "as-page"}`} onSubmit={submit}>
      <header className="quick-inspection-head">
        <div>
          <span className="eyebrow">快速巡檢清單</span>
          <h2>{isEdit ? "編輯巡檢" : "新增今日巡檢"}</h2>
          <p>分成每日與每月清單，異常與待觀察才需要補充說明。</p>
        </div>
        {onCancel ? (
          <button className="quick-close-btn" type="button" onClick={onCancel} aria-label="關閉">
            ×
          </button>
        ) : null}
      </header>

      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="inspection-notice compact">{message}</div> : null}

      <nav className="inspection-period-tabs compact" aria-label="巡檢分類">
        {Object.values(INSPECTION_PERIODS).map((period) => (
          <button
            key={period.key}
            type="button"
            className={activePeriod === period.key ? "active" : ""}
            onClick={() => setActivePeriod(period.key)}
          >
            <span>{period.label}</span>
            <strong>{period.title}</strong>
          </button>
        ))}
      </nav>

      <section className="quick-inspection-meta">
        <label>
          日期
          <input
            type="date"
            value={form.inspection_date}
            onChange={(event) => setForm((current) => ({ ...current, inspection_date: event.target.value }))}
            required
          />
        </label>
        <label>
          巡檢人員
          <input
            value={form.inspector_name}
            onChange={(event) => setForm((current) => ({ ...current, inspector_name: event.target.value }))}
            placeholder="Admin"
            required
          />
        </label>
        <div className="quick-overall-status">
          <span>整體狀態</span>
          <InspectionStatusBadge value={summary.overall_status} />
        </div>
      </section>

      <section className="quick-summary-strip" aria-label="巡檢摘要">
        <div><span>總數</span><strong>{summary.item_count}</strong></div>
        <div><span>正常</span><strong>{summary.normal_count}</strong></div>
        <div><span>異常</span><strong>{summary.abnormal_count}</strong></div>
        <div><span>待觀察</span><strong>{summary.observation_count}</strong></div>
        <div><span>未檢查</span><strong>{summary.unchecked_count}</strong></div>
      </section>

      <div className="quick-action-bar">
        <button type="button" onClick={markAllNormal}>全部正常</button>
        <button type="button" onClick={clearAll}>清除全部</button>
        <button
          type="button"
          className={showAttentionOnly ? "active" : ""}
          onClick={() => setShowAttentionOnly((value) => !value)}
        >
          只顯示異常
        </button>
      </div>

      <section className="quick-item-list">
        {visibleItems.length ? visibleItems.map((item) => {
          const itemIndex = form.items.indexOf(item);
          const attention = needsIssueFields(item.status);
          return (
            <article className={`quick-item-row ${attention ? "needs-attention" : ""}`} key={`${item.category}-${item.item_name}`}>
              <div className="quick-item-main">
                <div>
                  <span>{item.category}</span>
                  <strong>{item.item_name}</strong>
                </div>
                <div className="quick-status-buttons">
                  {ITEM_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={normalizeInspectionStatus(item.status) === status ? "active" : ""}
                      onClick={() => updateItem(itemIndex, { status })}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              {attention ? (
                <div className="quick-issue-fields">
                  <label>
                    備註
                    <textarea
                      value={item.issue_description}
                      onChange={(event) => updateItem(itemIndex, { issue_description: event.target.value })}
                      placeholder="請簡述異常或待觀察狀況"
                      required={normalizeInspectionStatus(item.status) === "異常"}
                    />
                  </label>
                  <label>
                    處理說明
                    <textarea
                      value={item.handling_method}
                      onChange={(event) => updateItem(itemIndex, { handling_method: event.target.value })}
                      placeholder="可選填已處理、通報或後續追蹤方式"
                    />
                  </label>
                </div>
              ) : null}
            </article>
          );
        }) : (
          <div className="quick-empty-filter">目前沒有異常或待觀察項目。</div>
        )}
      </section>

      <label className="quick-note">
        本日補充說明
        <textarea
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          placeholder="可選填今日巡檢補充事項"
        />
      </label>

      <footer className="quick-footer-actions">
        <button type="button" onClick={saveDraft}>儲存草稿</button>
        <button className="primary-action" type="submit" disabled={saving}>
          {saving ? "儲存中..." : "完成巡檢"}
        </button>
      </footer>
    </form>
  );
}
