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
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
      cache: "no-store"
    });
  } catch {
    const error = new Error("目前無法連線，巡檢內容已保留在這台裝置。");
    error.code = "NETWORK_ERROR";
    throw error;
  }
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

function legacyDraftKey(recordId, date) {
  return `daily-inspection-draft:${recordId || date || "today"}`;
}

function draftKey(recordId) {
  return `daily-inspection-draft-v2:${recordId || "new"}`;
}

function readDraft(recordId, date) {
  const keys = [draftKey(recordId), legacyDraftKey(recordId, date)];
  for (const key of keys) {
    const saved = window.localStorage.getItem(key);
    if (!saved) continue;
    try {
      const draft = JSON.parse(saved);
      if (draft?.items?.length) return draft;
    } catch {
      window.localStorage.removeItem(key);
    }
  }
  return null;
}

function persistDraft(recordId, form, pendingSubmission = false) {
  const savedAt = new Date().toISOString();
  window.localStorage.setItem(draftKey(recordId), JSON.stringify({
    ...form,
    _draft: {
      version: 2,
      saved_at: savedAt,
      pending_submission: pendingSubmission
    }
  }));
  return savedAt;
}

function clearDraft(recordId, date) {
  window.localStorage.removeItem(draftKey(recordId));
  window.localStorage.removeItem(legacyDraftKey(recordId, date));
  window.localStorage.removeItem(legacyDraftKey("", date));
}

function formatDraftTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
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
  const [online, setOnline] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [dirty, setDirty] = useState(false);
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
    setOnline(window.navigator.onLine);

    function handleOnline() {
      setOnline(true);
      setMessage("網路已恢復，請確認內容後按「完成巡檢」送出。");
    }

    function handleOffline() {
      setOnline(false);
      setMessage("目前離線，巡檢內容會自動暫存在這台裝置。");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRecord() {
      const savedDraft = readDraft(recordId, todayTaipei());
      if (!isEdit) {
        if (active && savedDraft?.items?.length) {
          setForm({
            inspection_date: savedDraft.inspection_date || todayTaipei(),
            inspector_name: savedDraft.inspector_name || "Admin",
            note: savedDraft.note || "",
            items: savedDraft.items.map(normalizeFormItem)
          });
          setMessage(savedDraft._draft?.pending_submission
            ? "已載入離線暫存的巡檢，連線後請再次送出。"
            : "已載入尚未完成的本機草稿。");
          if (savedDraft._draft?.saved_at) {
            setDraftStatus(`上次暫存 ${formatDraftTime(savedDraft._draft.saved_at)}`);
          }
        }
        if (active) setDraftReady(true);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const data = await api(`/api/inspections/${recordId}`);
        const record = data.record;
        if (!active) return;
        if (savedDraft?.items?.length) {
          setForm({
            inspection_date: savedDraft.inspection_date || String(record.inspection_date || "").slice(0, 10),
            inspector_name: savedDraft.inspector_name || record.inspector_name || "Admin",
            note: savedDraft.note || "",
            items: savedDraft.items.map(normalizeFormItem)
          });
          setMessage("已載入這筆巡檢尚未送出的本機草稿。");
          if (savedDraft._draft?.saved_at) setDraftStatus(`上次暫存 ${formatDraftTime(savedDraft._draft.saved_at)}`);
        } else {
          setForm({
            inspection_date: String(record.inspection_date || "").slice(0, 10),
            inspector_name: record.inspector_name || "Admin",
            note: record.note || "",
            items: (record.items || []).map(normalizeFormItem)
          });
        }
      } catch (err) {
        if (active && savedDraft?.items?.length) {
          setForm({
            inspection_date: savedDraft.inspection_date || todayTaipei(),
            inspector_name: savedDraft.inspector_name || "Admin",
            note: savedDraft.note || "",
            items: savedDraft.items.map(normalizeFormItem)
          });
          setMessage("目前無法連線，已改為載入這台裝置上的巡檢草稿。");
        } else if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
          setDraftReady(true);
        }
      }
    }

    loadRecord();
    return () => {
      active = false;
    };
  }, [isEdit, recordId]);

  useEffect(() => {
    if (!draftReady || !dirty) return undefined;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = persistDraft(recordId, form);
        setDraftStatus(`已自動暫存 ${formatDraftTime(savedAt)}`);
      } catch {
        setDraftStatus("本機暫存空間不足，請先送出或清理瀏覽器空間");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, draftReady, form, recordId]);

  function updateForm(patch) {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateItem(index, patch) {
    setDirty(true);
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
    setDirty(true);
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
    setDirty(true);
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
    try {
      const savedAt = persistDraft(recordId, form, !online);
      setDraftStatus(`已手動暫存 ${formatDraftTime(savedAt)}`);
      setMessage("草稿已儲存在這台裝置的瀏覽器。");
    } catch {
      setError("無法儲存本機草稿，請先清理瀏覽器儲存空間。");
    }
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
      if (!window.navigator.onLine) {
        const savedAt = persistDraft(recordId, form, true);
        setOnline(false);
        setDraftStatus(`離線暫存 ${formatDraftTime(savedAt)}`);
        setMessage("目前離線，資料尚未送到伺服器；恢復網路後請再按一次「完成巡檢」。");
        return;
      }
      const data = await api(isEdit ? `/api/inspections/${recordId}` : "/api/inspections", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(body)
      });
      clearDraft(recordId, form.inspection_date);
      onSaved?.(data.record);
    } catch (err) {
      if (err.code === "NETWORK_ERROR" || !window.navigator.onLine) {
        const savedAt = persistDraft(recordId, form, true);
        setOnline(false);
        setDraftStatus(`連線中斷，已暫存 ${formatDraftTime(savedAt)}`);
        setMessage("網路連線不穩，巡檢內容已暫存在這台裝置；恢復網路後請重新送出。");
      } else {
        setError(err.message);
      }
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
      <div className={`inspection-connectivity ${online ? "is-online" : "is-offline"}`} role="status">
        <span><i aria-hidden="true" />{online ? "網路連線正常" : "離線模式"}</span>
        <small>{draftStatus || "開始填寫後會自動暫存"}</small>
      </div>

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
            onChange={(event) => updateForm({ inspection_date: event.target.value })}
            required
          />
        </label>
        <label>
          巡檢人員
          <input
            value={form.inspector_name}
            onChange={(event) => updateForm({ inspector_name: event.target.value })}
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
          onChange={(event) => updateForm({ note: event.target.value })}
          placeholder="可選填今日巡檢補充事項"
        />
      </label>

      <footer className="quick-footer-actions">
        <button type="button" onClick={saveDraft}>儲存草稿</button>
        <button className="primary-action" type="submit" disabled={saving}>
          {saving ? "儲存中..." : (online ? "完成巡檢" : "離線暫存巡檢")}
        </button>
      </footer>
    </form>
  );
}
