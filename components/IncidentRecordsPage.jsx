"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "taroko-it-incident-records";

const DEPARTMENTS = ["房務", "櫃檯", "餐飲", "財務", "業務", "人資", "工務", "管理部", "資訊部", "其他"];
const INCIDENT_TYPES = ["網路", "硬體", "軟體", "系統", "帳號", "印表機", "Wi-Fi", "電話", "監視器", "NAS / 備份", "PMS", "POS", "門鎖系統", "廠商系統", "其他"];
const IMPACT_SCOPES = ["單一人員", "單一部門", "多部門", "全館", "客人受影響", "其他"];
const PRIORITIES = ["低", "中", "高", "緊急"];
const STATUSES = ["未處理", "處理中", "待廠商", "已完成", "已結案"];
const RECURRING_OPTIONS = ["全部", "是", "否"];
const ALL_VALUE = "全部";

const MOCK_INCIDENTS = [
  {
    id: "mock-1",
    incidentNo: "IT-20260615-001",
    occurredAt: "2026-06-15T09:20",
    reportedAt: "2026-06-15T09:30",
    department: "櫃檯",
    reporter: "王小姐",
    type: "PMS",
    impactScope: "單一部門",
    priority: "高",
    description: "櫃檯 PMS 無法登入，影響入住作業。",
    assignee: "IT",
    status: "處理中",
    resolution: "",
    completedAt: "",
    isRecurring: false,
    relatedDevice: "",
    relatedVendor: "PMS 廠商",
    attachments: []
  },
  {
    id: "mock-2",
    incidentNo: "IT-20260615-002",
    occurredAt: "2026-06-15T10:10",
    reportedAt: "2026-06-15T10:15",
    department: "房務",
    reporter: "林小姐",
    type: "Wi-Fi",
    impactScope: "客人受影響",
    priority: "中",
    description: "客房反映 Wi-Fi 連線不穩。",
    assignee: "IT",
    status: "已完成",
    resolution: "重啟樓層 AP 後恢復正常。",
    completedAt: "2026-06-15T10:45",
    isRecurring: false,
    relatedDevice: "3F AP",
    relatedVendor: "",
    attachments: []
  },
  {
    id: "mock-3",
    incidentNo: "IT-20260615-003",
    occurredAt: "2026-06-15T11:00",
    reportedAt: "2026-06-15T11:05",
    department: "財務",
    reporter: "陳先生",
    type: "印表機",
    impactScope: "單一部門",
    priority: "低",
    description: "財務部印表機無法列印。",
    assignee: "IT",
    status: "待廠商",
    resolution: "初步判斷為定著器異常，已通知廠商。",
    completedAt: "",
    isRecurring: true,
    relatedDevice: "財務部印表機",
    relatedVendor: "影印機廠商",
    attachments: []
  }
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateKeyFromValue(value) {
  return String(value || toLocalInputValue()).slice(0, 10).replaceAll("-", "");
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDateTime(value);
  if (!date) return "-";
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDurationMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "-";
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours} 小時 ${remainingMinutes} 分鐘`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days} 天 ${remainingHours} 小時`;
}

function getDurationMinutes(record) {
  const start = parseDateTime(record.reportedAt);
  const end = parseDateTime(record.completedAt);
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / 60000;
}

function getDurationLabel(record) {
  const minutes = getDurationMinutes(record);
  return minutes === null ? "尚未完成" : formatDurationMinutes(minutes);
}

function generateIncidentNo(records, reportedAt) {
  const dateKey = dateKeyFromValue(reportedAt);
  const prefix = `IT-${dateKey}-`;
  const maxSequence = records.reduce((max, record) => {
    if (!String(record.incidentNo || "").startsWith(prefix)) return max;
    const sequence = Number(String(record.incidentNo).slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

function createBlankIncident(records) {
  const now = toLocalInputValue();
  return {
    id: "",
    incidentNo: generateIncidentNo(records, now),
    occurredAt: now,
    reportedAt: now,
    department: "",
    reporter: "",
    type: "",
    impactScope: "",
    priority: "中",
    description: "",
    assignee: "",
    status: "未處理",
    resolution: "",
    completedAt: "",
    isRecurring: false,
    relatedDevice: "",
    relatedVendor: "",
    attachments: []
  };
}

function priorityTone(priority) {
  return {
    低: "low",
    中: "medium",
    高: "high",
    緊急: "critical"
  }[priority] || "medium";
}

function statusTone(status) {
  return {
    未處理: "todo",
    處理中: "active",
    待廠商: "vendor",
    已完成: "done",
    已結案: "closed"
  }[status] || "todo";
}

function validateIncident(form) {
  const errors = [];
  const requiredFields = [
    ["occurredAt", "發生時間"],
    ["reportedAt", "通報時間"],
    ["department", "通報單位"],
    ["reporter", "通報人"],
    ["type", "故障類型"],
    ["impactScope", "影響範圍"],
    ["priority", "緊急程度"],
    ["description", "問題描述"],
    ["status", "處理狀態"]
  ];

  requiredFields.forEach(([key, label]) => {
    if (!String(form[key] || "").trim()) errors.push(`${label}必填`);
  });

  const occurredAt = parseDateTime(form.occurredAt);
  const reportedAt = parseDateTime(form.reportedAt);
  const completedAt = parseDateTime(form.completedAt);
  if (completedAt && occurredAt && completedAt < occurredAt) errors.push("完成時間不可早於發生時間");
  if (completedAt && reportedAt && completedAt < reportedAt) errors.push("完成時間不可早於通報時間");

  if (["已完成", "已結案"].includes(form.status)) {
    if (!String(form.resolution || "").trim()) errors.push("已完成或已結案案件需填寫解決方式");
    if (!form.completedAt) errors.push("已完成或已結案案件需填寫完成時間");
  }

  return errors;
}

function matchesDateRange(record, dateField, startDate, endDate) {
  const rawValue = record[dateField];
  if (!rawValue) return false;
  const day = String(rawValue).slice(0, 10);
  if (startDate && day < startDate) return false;
  if (endDate && day > endDate) return false;
  return true;
}

function OptionSelect({ value, onChange, options, placeholder, disabled = false, required = false }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children, required = false, wide = false }) {
  return (
    <label className={`incident-field ${wide ? "wide" : ""}`}>
      <span>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      {children}
    </label>
  );
}

function IncidentBadge({ type, value }) {
  const tone = type === "priority" ? priorityTone(value) : statusTone(value);
  return <span className={`incident-badge ${type}-${tone}`}>{value}</span>;
}

function IncidentFormModal({ mode, form, onChange, onClose, onSubmit, errors }) {
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  const title = mode === "create" ? "新增故障案件" : isEdit ? "編輯故障案件" : "查看故障案件";

  function setValue(key, value) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="incident-modal-backdrop" role="presentation">
      <form className="incident-modal" onSubmit={onSubmit}>
        <header>
          <div>
            <h2>{title}</h2>
            <p>{form.incidentNo}</p>
          </div>
          <button type="button" aria-label="關閉" onClick={onClose}>
            x
          </button>
        </header>

        {errors.length ? (
          <div className="incident-form-errors">
            {errors.map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        ) : null}

        <div className="incident-form-grid">
          <Field label="案件編號">
            <input value={form.incidentNo} readOnly />
          </Field>
          <Field label="發生時間" required>
            <input type="datetime-local" value={form.occurredAt} onChange={(event) => setValue("occurredAt", event.target.value)} disabled={readonly} required />
          </Field>
          <Field label="通報時間" required>
            <input type="datetime-local" value={form.reportedAt} onChange={(event) => setValue("reportedAt", event.target.value)} disabled={readonly} required />
          </Field>
          <Field label="通報單位" required>
            <OptionSelect value={form.department} onChange={(value) => setValue("department", value)} options={DEPARTMENTS} placeholder="請選擇" disabled={readonly} required />
          </Field>
          <Field label="通報人" required>
            <input value={form.reporter} onChange={(event) => setValue("reporter", event.target.value)} disabled={readonly} required />
          </Field>
          <Field label="故障類型" required>
            <OptionSelect value={form.type} onChange={(value) => setValue("type", value)} options={INCIDENT_TYPES} placeholder="請選擇" disabled={readonly} required />
          </Field>
          <Field label="影響範圍" required>
            <OptionSelect value={form.impactScope} onChange={(value) => setValue("impactScope", value)} options={IMPACT_SCOPES} placeholder="請選擇" disabled={readonly} required />
          </Field>
          <Field label="緊急程度" required>
            <OptionSelect value={form.priority} onChange={(value) => setValue("priority", value)} options={PRIORITIES} disabled={readonly} required />
          </Field>
          <Field label="處理人員">
            <input value={form.assignee} onChange={(event) => setValue("assignee", event.target.value)} disabled={readonly} />
          </Field>
          <Field label="處理狀態" required>
            <OptionSelect value={form.status} onChange={(value) => setValue("status", value)} options={STATUSES} disabled={readonly} required />
          </Field>
          <Field label="完成時間">
            <input type="datetime-local" value={form.completedAt} onChange={(event) => setValue("completedAt", event.target.value)} disabled={readonly} />
          </Field>
          <Field label="是否重複發生">
            <select value={form.isRecurring ? "是" : "否"} onChange={(event) => setValue("isRecurring", event.target.value === "是")} disabled={readonly}>
              <option value="否">否</option>
              <option value="是">是</option>
            </select>
          </Field>
          {/* Device and vendor fields can become relation selects when those APIs are ready. */}
          <Field label="關聯設備">
            <input value={form.relatedDevice} onChange={(event) => setValue("relatedDevice", event.target.value)} disabled={readonly} placeholder="可先輸入設備名稱" />
          </Field>
          <Field label="關聯廠商">
            <input value={form.relatedVendor} onChange={(event) => setValue("relatedVendor", event.target.value)} disabled={readonly} placeholder="可先輸入廠商名稱" />
          </Field>
          <Field label="附件">
            <input value="目前先預留欄位，尚未實作附件上傳" readOnly disabled />
          </Field>
          <Field label="耗時">
            <input value={getDurationLabel(form)} readOnly />
          </Field>
          <Field label="問題描述" required wide>
            <textarea value={form.description} onChange={(event) => setValue("description", event.target.value)} disabled={readonly} required rows={4} />
          </Field>
          <Field label="解決方式" wide>
            <textarea value={form.resolution} onChange={(event) => setValue("resolution", event.target.value)} disabled={readonly} rows={4} />
          </Field>
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            {readonly ? "關閉" : "取消"}
          </button>
          {!readonly ? (
            <button className="primary" type="submit">
              儲存
            </button>
          ) : null}
        </footer>
      </form>
    </div>
  );
}

function getStats(records) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const completedDurations = records.map(getDurationMinutes).filter((value) => value !== null && value >= 0);
  const averageMinutes = completedDurations.length
    ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length
    : null;

  return [
    { label: "本月案件數", value: records.filter((record) => String(record.reportedAt).startsWith(monthKey)).length, helper: "依通報時間計算" },
    { label: "未處理案件數", value: records.filter((record) => record.status === "未處理").length, helper: "需要優先分派" },
    { label: "處理中案件數", value: records.filter((record) => record.status === "處理中").length, helper: "IT 正在處理" },
    { label: "待廠商案件數", value: records.filter((record) => record.status === "待廠商").length, helper: "需外部支援" },
    { label: "緊急案件數", value: records.filter((record) => record.priority === "緊急").length, helper: "紅色優先追蹤", tone: "danger" },
    { label: "平均處理時間", value: averageMinutes === null ? "-" : formatDurationMinutes(averageMinutes), helper: "已完成案件平均" }
  ];
}

export default function IncidentRecordsPage() {
  const [records, setRecords] = useState(MOCK_INCIDENTS);
  const [filters, setFilters] = useState({
    query: "",
    type: ALL_VALUE,
    status: ALL_VALUE,
    priority: ALL_VALUE,
    department: ALL_VALUE,
    recurring: ALL_VALUE,
    dateField: "occurredAt",
    startDate: "",
    endDate: ""
  });
  const [modalMode, setModalMode] = useState("");
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setRecords(JSON.parse(stored));
    } catch {
      setRecords(MOCK_INCIDENTS);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const stats = useMemo(() => getStats(records), [records]);

  const filteredRecords = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase();
    return records.filter((record) => {
      const searchable = [record.incidentNo, record.description, record.reporter, record.assignee].join(" ").toLowerCase();
      const matchKeyword = !keyword || searchable.includes(keyword);
      const matchType = filters.type === ALL_VALUE || record.type === filters.type;
      const matchStatus = filters.status === ALL_VALUE || record.status === filters.status;
      const matchPriority = filters.priority === ALL_VALUE || record.priority === filters.priority;
      const matchDepartment = filters.department === ALL_VALUE || record.department === filters.department;
      const matchRecurring =
        filters.recurring === ALL_VALUE ||
        (filters.recurring === "是" && record.isRecurring) ||
        (filters.recurring === "否" && !record.isRecurring);
      const hasDateFilter = filters.startDate || filters.endDate;
      const matchDate = !hasDateFilter || matchesDateRange(record, filters.dateField, filters.startDate, filters.endDate);
      return matchKeyword && matchType && matchStatus && matchPriority && matchDepartment && matchRecurring && matchDate;
    });
  }, [records, filters]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({
      query: "",
      type: ALL_VALUE,
      status: ALL_VALUE,
      priority: ALL_VALUE,
      department: ALL_VALUE,
      recurring: ALL_VALUE,
      dateField: "occurredAt",
      startDate: "",
      endDate: ""
    });
  }

  function openCreate() {
    setErrors([]);
    setForm(createBlankIncident(records));
    setModalMode("create");
  }

  function openRecord(record, mode) {
    setErrors([]);
    setForm({ ...record });
    setModalMode(mode);
  }

  function closeModal() {
    setModalMode("");
    setForm(null);
    setErrors([]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateIncident(form);
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    if (modalMode === "create") {
      const incident = {
        ...form,
        id: `incident-${Date.now()}`,
        incidentNo: generateIncidentNo(records, form.reportedAt),
        attachments: []
      };
      setRecords((current) => [incident, ...current]);
    } else if (modalMode === "edit") {
      setRecords((current) => current.map((record) => (record.id === form.id ? { ...form, attachments: form.attachments || [] } : record)));
    }
    closeModal();
  }

  function deleteRecord(record) {
    const confirmed = window.confirm(`確定要刪除 ${record.incidentNo} 嗎？`);
    if (!confirmed) return;
    setRecords((current) => current.filter((item) => item.id !== record.id));
  }

  return (
    <section className="section-page incident-page">
      <header className="incident-page-head">
        <div>
          <div className="breadcrumb">IT 管理 / 故障總表</div>
          <h1>故障總表 / 異常事件紀錄</h1>
        </div>
        <button className="primary-action" type="button" onClick={openCreate}>
          新增故障案件
        </button>
      </header>

      <div className="incident-stats-grid">
        {stats.map((card) => (
          <article className={`incident-stat-card ${card.tone === "danger" ? "is-danger" : ""}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.helper}</p>
          </article>
        ))}
      </div>

      <div className="incident-filter-panel">
        <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="搜尋案件編號、問題描述、通報人、處理人員" />
        <OptionSelect value={filters.type} onChange={(value) => updateFilter("type", value)} options={[ALL_VALUE, ...INCIDENT_TYPES]} />
        <OptionSelect value={filters.status} onChange={(value) => updateFilter("status", value)} options={[ALL_VALUE, ...STATUSES]} />
        <OptionSelect value={filters.priority} onChange={(value) => updateFilter("priority", value)} options={[ALL_VALUE, ...PRIORITIES]} />
        <OptionSelect value={filters.department} onChange={(value) => updateFilter("department", value)} options={[ALL_VALUE, ...DEPARTMENTS]} />
        <OptionSelect value={filters.recurring} onChange={(value) => updateFilter("recurring", value)} options={RECURRING_OPTIONS} />
        <select value={filters.dateField} onChange={(event) => updateFilter("dateField", event.target.value)}>
          <option value="occurredAt">依發生時間</option>
          <option value="reportedAt">依通報時間</option>
        </select>
        <input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} aria-label="開始日期" />
        <input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} aria-label="結束日期" />
        <button className="plain-reset" type="button" onClick={resetFilters}>
          重設
        </button>
        <span>{filteredRecords.length.toLocaleString("en-US")} 筆</span>
      </div>

      <div className="incident-table-wrap">
        <table className="incident-table">
          <thead>
            <tr>
              <th>案件編號</th>
              <th>發生時間</th>
              <th>通報單位</th>
              <th>故障類型</th>
              <th>影響範圍</th>
              <th>緊急程度</th>
              <th>處理狀態</th>
              <th>處理人員</th>
              <th>完成時間</th>
              <th>耗時</th>
              <th>重複</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length ? (
              filteredRecords.map((record) => (
                <tr key={record.id} className={record.status === "已結案" ? "is-closed" : record.priority === "緊急" || record.status === "未處理" ? "needs-attention" : ""}>
                  <td className="incident-no">{record.incidentNo}</td>
                  <td>{formatDateTime(record.occurredAt)}</td>
                  <td>{record.department}</td>
                  <td>{record.type}</td>
                  <td>{record.impactScope}</td>
                  <td>
                    <IncidentBadge type="priority" value={record.priority} />
                  </td>
                  <td>
                    <IncidentBadge type="status" value={record.status} />
                  </td>
                  <td>{record.assignee || "-"}</td>
                  <td>{formatDateTime(record.completedAt)}</td>
                  <td>{getDurationLabel(record)}</td>
                  <td>{record.isRecurring ? "是" : "否"}</td>
                  <td>
                    <div className="incident-row-actions">
                      <button type="button" onClick={() => openRecord(record, "view")}>
                        查看
                      </button>
                      <button type="button" onClick={() => openRecord(record, "edit")}>
                        編輯
                      </button>
                      <button className="danger" type="button" onClick={() => deleteRecord(record)}>
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12}>目前沒有符合條件的故障案件</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form ? (
        <IncidentFormModal mode={modalMode} form={form} onChange={setForm} onClose={closeModal} onSubmit={handleSubmit} errors={errors} />
      ) : null}
    </section>
  );
}
