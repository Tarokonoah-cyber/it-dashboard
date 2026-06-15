"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InspectionStatusBadge from "./InspectionStatusBadge";
import {
  HANDLING_STATUSES,
  ITEM_STATUSES,
  calculateInspectionSummary,
  createTemplateItems,
  needsIssueFields
} from "./inspectionTemplates";

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const error = new Error(data.message || "資料儲存失敗");
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
    attachments_text: Array.isArray(item.attachments) ? item.attachments.join("\n") : ""
  };
}

function payloadItems(items) {
  return items.map((item) => ({
    ...item,
    attachments: String(item.attachments_text || "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }));
}

export default function InspectionForm({ mode = "new", recordId = "" }) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingRecord, setExistingRecord] = useState(null);
  const [form, setForm] = useState({
    inspection_date: todayTaipei(),
    inspector_name: "",
    note: "",
    items: createTemplateItems().map(normalizeFormItem)
  });

  const summary = useMemo(() => calculateInspectionSummary(payloadItems(form.items)), [form.items]);

  async function loadRecord(id) {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/inspections/${id}`);
      const record = data.record;
      setForm({
        inspection_date: String(record.inspection_date || "").slice(0, 10),
        inspector_name: record.inspector_name || "",
        note: record.note || "",
        items: (record.items || []).map(normalizeFormItem)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkExistingForDate(date) {
    if (isEdit) return;
    if (!date) {
      setExistingRecord(null);
      return;
    }
    try {
      const data = await api(`/api/inspections?date=${encodeURIComponent(date)}`);
      setExistingRecord(data.rows?.[0] || null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (isEdit && recordId) loadRecord(recordId);
    else checkExistingForDate(form.inspection_date);
  }, [isEdit, recordId, form.inspection_date]);

  function updateItem(index, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.status && !needsIssueFields(patch.status)) {
          next.issue_description = "";
          next.handling_status = "未處理";
          next.handling_method = "";
          next.attachments_text = "";
          next.note = item.note || "";
        }
        return next;
      })
    }));
  }

  function markAllNormal() {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => ({
        ...item,
        status: "正常",
        issue_description: "",
        handling_status: "未處理",
        handling_method: "",
        attachments_text: ""
      }))
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
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
      router.push(`/inspections/${data.record.id}`);
    } catch (err) {
      if (err.code === "INSPECTION_DATE_EXISTS" && err.data?.id) {
        setExistingRecord({ id: err.data.id });
      }
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="section-page inspection-page"><div className="empty">讀取巡檢紀錄中...</div></section>;

  return (
    <section className="section-page inspection-page">
      <header className="section-head">
        <div>
          <h1>{isEdit ? "編輯每日巡檢紀錄" : "新增每日巡檢紀錄"}</h1>
          <p>同一天只允許一張巡檢紀錄，巡檢人員名稱為必填</p>
        </div>
        <div className="section-actions">
          <button onClick={() => router.push("/inspections")}>回列表</button>
          <button onClick={markAllNormal}>全部標記正常</button>
        </div>
      </header>

      {existingRecord && !isEdit ? (
        <div className="inspection-notice">
          此日期已存在巡檢紀錄，請改為編輯既有紀錄。
          <button onClick={() => router.push(`/inspections/${existingRecord.id}/edit`)}>前往編輯</button>
        </div>
      ) : null}
      {error ? <div className="error-box">{error}</div> : null}

      <form className="inspection-form" onSubmit={submit}>
        <section className="inspection-main-panel">
          <label>
            巡檢日期
            <input type="date" value={form.inspection_date} onChange={(event) => setForm((current) => ({ ...current, inspection_date: event.target.value }))} required />
          </label>
          <label>
            巡檢人員
            <input value={form.inspector_name} onChange={(event) => setForm((current) => ({ ...current, inspector_name: event.target.value }))} placeholder="請輸入姓名" required />
          </label>
          <label>
            整體狀態
            <InspectionStatusBadge value={summary.overall_status} />
          </label>
          <label className="wide">
            備註
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="可記錄交接提醒或補充說明" />
          </label>
        </section>

        <section className="inspection-items-panel">
          <header>
            <h2>巡檢項目明細</h2>
            <span>{summary.item_count} 項，異常 {summary.abnormal_count}，需觀察 {summary.observation_count}</span>
          </header>
          <div className="inspection-item-list">
            {form.items.map((item, index) => {
              const showIssueFields = needsIssueFields(item.status);
              return (
                <article className={`inspection-item-card ${showIssueFields ? "needs-attention" : ""}`} key={`${item.category}-${item.item_name}`}>
                  <div className="inspection-item-head">
                    <div>
                      <span>{item.category}</span>
                      <h3>{item.item_name}</h3>
                    </div>
                    <div className="inspection-status-options">
                      {ITEM_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={item.status === status ? "active" : ""}
                          onClick={() => updateItem(index, { status })}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {showIssueFields ? (
                    <div className="inspection-issue-grid">
                      <label className="wide">
                        異常說明
                        <textarea value={item.issue_description} onChange={(event) => updateItem(index, { issue_description: event.target.value })} required={item.status === "異常"} />
                      </label>
                      <label>
                        處理狀態
                        <select value={item.handling_status} onChange={(event) => updateItem(index, { handling_status: event.target.value })}>
                          {HANDLING_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </label>
                      <label className="wide">
                        處理方式
                        <textarea value={item.handling_method} onChange={(event) => updateItem(index, { handling_method: event.target.value })} />
                      </label>
                      <label className="wide">
                        附件 URL 或文字備註
                        <textarea value={item.attachments_text || ""} onChange={(event) => updateItem(index, { attachments_text: event.target.value })} placeholder="一行一筆，第一版先記錄文字或 URL" />
                      </label>
                    </div>
                  ) : null}

                  <label>
                    備註
                    <input value={item.note || ""} onChange={(event) => updateItem(index, { note: event.target.value })} />
                  </label>
                </article>
              );
            })}
          </div>
        </section>

        <div className="inspection-form-actions">
          <button type="button" onClick={() => router.push("/inspections")}>取消</button>
          <button className="primary-action" type="submit" disabled={saving || Boolean(existingRecord && !isEdit)}>
            {saving ? "儲存中..." : "儲存巡檢紀錄"}
          </button>
        </div>
      </form>
    </section>
  );
}
