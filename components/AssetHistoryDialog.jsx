"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const EMPTY_PROFILE = {
  purchase_date: "",
  purchase_vendor: "",
  purchase_cost: "",
  serial_number: "",
  warranty_end_date: "",
  warranty_note: ""
};

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function emptyMaintenance() {
  return {
    service_date: taipeiDate(),
    event_type: "維修",
    summary: "",
    vendor: "",
    cost: "",
    status: "已完成",
    note: ""
  };
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "設備履歷操作失敗");
  return payload.data;
}

function getField(record, keys, fallback = "") {
  const data = record?.data || record || {};
  for (const key of keys) {
    const value = data[key];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return fallback;
}

function displayName(record) {
  return getField(record, ["電腦名稱", "設備名稱", "名稱", "asset_name", "computer_name"], "未命名設備");
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  return Number.isFinite(amount) ? `NT$${amount.toLocaleString("en-US")}` : String(value);
}

function WarrantyBadge({ status }) {
  const code = status?.code || "unset";
  return <span className={`asset-warranty-badge is-${code}`}>{status?.label || "未設定"}</span>;
}

export default function AssetHistoryDialog({ record, onClose, onSaved }) {
  const [detail, setDetail] = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [maintenance, setMaintenance] = useState([]);
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenance);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const recordId = String(record?.id || "").trim();
  const path = `/api/assets/${encodeURIComponent(recordId)}/history`;
  const fallbackName = useMemo(() => displayName(record), [record]);

  const load = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api(path);
      setDetail(data.asset);
      setMaintenance(data.maintenance || []);
      setProfile({
        purchase_date: data.asset?.purchase_date || "",
        purchase_vendor: data.asset?.purchase_vendor || "",
        purchase_cost: data.asset?.purchase_cost ?? "",
        serial_number: data.asset?.serial_number || "",
        warranty_end_date: data.asset?.warranty_end_date || "",
        warranty_note: data.asset?.warranty_note || ""
      });
    } catch (loadError) {
      setError(loadError.message || "設備履歷讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [path, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.body.classList.add("asset-history-open");
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("asset-history-open");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function updateMaintenance(field, value) {
    setMaintenanceForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      const data = await api(path, { method: "PATCH", body: JSON.stringify({ profile }) });
      setDetail(data.asset);
      setProfile((current) => ({
        ...current,
        purchase_cost: data.asset?.purchase_cost ?? ""
      }));
      setNotice("採購與保固資料已儲存");
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message || "保固資料儲存失敗");
    } finally {
      setSavingProfile(false);
    }
  }

  async function addMaintenance(event) {
    event.preventDefault();
    setSavingMaintenance(true);
    setError("");
    setNotice("");
    try {
      const data = await api(path, {
        method: "POST",
        body: JSON.stringify({ maintenance: maintenanceForm })
      });
      if (data.maintenance) setMaintenance((current) => [data.maintenance, ...current]);
      setMaintenanceForm(emptyMaintenance());
      setShowMaintenanceForm(false);
      setNotice("維修履歷已新增");
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message || "維修履歷新增失敗");
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function deleteMaintenance(item) {
    if (!window.confirm(`確定刪除「${item.summary}」這筆履歷？`)) return;
    setDeletingId(item.id);
    setError("");
    setNotice("");
    try {
      await api(path, { method: "DELETE", body: JSON.stringify({ maintenanceId: item.id }) });
      setMaintenance((current) => current.filter((row) => row.id !== item.id));
      setNotice("維修履歷已刪除");
    } catch (deleteError) {
      setError(deleteError.message || "維修履歷刪除失敗");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="asset-history-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="asset-history-modal" role="dialog" aria-modal="true" aria-labelledby="asset-history-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="asset-history-head">
          <div>
            <span>設備完整履歷</span>
            <h2 id="asset-history-title">{detail?.asset_name || fallbackName}</h2>
          </div>
          <div className="asset-history-head-actions">
            {detail ? <WarrantyBadge status={detail.warranty_status} /> : null}
            <button type="button" onClick={onClose} aria-label="關閉設備履歷">×</button>
          </div>
        </header>

        {loading ? <div className="asset-history-state">讀取設備履歷中...</div> : null}
        {error ? <div className="asset-history-alert is-error" role="alert">{error}</div> : null}
        {notice ? <div className="asset-history-alert is-success" role="status">{notice}</div> : null}

        {!loading && detail ? (
          <>
            <dl className="asset-history-summary">
              <div><dt>設備類型</dt><dd>{detail.asset_type || "-"}</dd></div>
              <div><dt>部門／使用者</dt><dd>{[detail.department, detail.user_name].filter(Boolean).join("／") || "-"}</dd></div>
              <div><dt>型號</dt><dd>{detail.model || "-"}</dd></div>
              <div><dt>IP 位址</dt><dd>{detail.ip_address || "-"}</dd></div>
            </dl>

            <form className="asset-profile-form" onSubmit={saveProfile}>
              <header>
                <div><span>採購與保固</span><h3>設備基本資料</h3></div>
                <button className="primary-action" type="submit" disabled={savingProfile}>{savingProfile ? "儲存中..." : "儲存資料"}</button>
              </header>
              <div className="asset-profile-grid">
                <label>採購日<input type="date" value={profile.purchase_date} onChange={(event) => updateProfile("purchase_date", event.target.value)} /></label>
                <label>保固期限<input type="date" value={profile.warranty_end_date} onChange={(event) => updateProfile("warranty_end_date", event.target.value)} /></label>
                <label>設備序號<input value={profile.serial_number} maxLength={160} onChange={(event) => updateProfile("serial_number", event.target.value)} placeholder="Serial Number" /></label>
                <label>採購廠商<input value={profile.purchase_vendor} maxLength={160} onChange={(event) => updateProfile("purchase_vendor", event.target.value)} /></label>
                <label>採購金額<input type="number" min="0" step="0.01" value={profile.purchase_cost} onChange={(event) => updateProfile("purchase_cost", event.target.value)} placeholder="0" /></label>
                <label className="asset-profile-wide">保固備註<textarea rows={3} value={profile.warranty_note} maxLength={2000} onChange={(event) => updateProfile("warranty_note", event.target.value)} placeholder="保固範圍、聯絡窗口或送修方式" /></label>
              </div>
            </form>

            <section className="asset-maintenance-section">
              <header>
                <div><span>MAINTENANCE</span><h3>維修與保養履歷</h3></div>
                <button type="button" onClick={() => setShowMaintenanceForm((value) => !value)}>{showMaintenanceForm ? "取消新增" : "＋ 新增履歷"}</button>
              </header>

              {showMaintenanceForm ? (
                <form className="asset-maintenance-form" onSubmit={addMaintenance}>
                  <label>處理日期<input type="date" required value={maintenanceForm.service_date} onChange={(event) => updateMaintenance("service_date", event.target.value)} /></label>
                  <label>類型<select value={maintenanceForm.event_type} onChange={(event) => updateMaintenance("event_type", event.target.value)}>{["維修", "保養", "更換", "送修", "其他"].map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label>狀態<select value={maintenanceForm.status} onChange={(event) => updateMaintenance("status", event.target.value)}>{["待處理", "處理中", "已完成", "取消"].map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="asset-maintenance-summary">處理摘要<input required maxLength={200} value={maintenanceForm.summary} onChange={(event) => updateMaintenance("summary", event.target.value)} placeholder="例如：更換硬碟並完成系統還原" /></label>
                  <label>廠商<input maxLength={160} value={maintenanceForm.vendor} onChange={(event) => updateMaintenance("vendor", event.target.value)} /></label>
                  <label>費用<input type="number" min="0" step="0.01" value={maintenanceForm.cost} onChange={(event) => updateMaintenance("cost", event.target.value)} /></label>
                  <label className="asset-maintenance-note">備註<textarea rows={3} maxLength={4000} value={maintenanceForm.note} onChange={(event) => updateMaintenance("note", event.target.value)} /></label>
                  <div className="asset-maintenance-form-actions"><button className="primary-action" type="submit" disabled={savingMaintenance}>{savingMaintenance ? "新增中..." : "新增履歷"}</button></div>
                </form>
              ) : null}

              <div className="asset-maintenance-timeline">
                {maintenance.length ? maintenance.map((item) => (
                  <article key={item.id}>
                    <i aria-hidden="true" />
                    <div>
                      <header><span>{item.service_date}</span><b>{item.event_type}</b><em>{item.status}</em></header>
                      <h4>{item.summary}</h4>
                      <p>{[item.vendor, formatMoney(item.cost), item.note].filter((value) => value && value !== "-").join(" · ") || "沒有補充說明"}</p>
                    </div>
                    <button className="danger" type="button" onClick={() => deleteMaintenance(item)} disabled={deletingId === item.id}>{deletingId === item.id ? "刪除中" : "刪除"}</button>
                  </article>
                )) : <div className="asset-history-state">尚未建立維修或保養履歷</div>}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
