"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InspectionStatusBadge from "./InspectionStatusBadge";
import { calculateInspectionSummary, needsIssueFields } from "./inspectionTemplates";

async function api(path) {
  const response = await fetch(path, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "資料讀取失敗");
  return data.data;
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "-";
}

function formatUpdatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function InspectionDetail({ recordId }) {
  const router = useRouter();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await api(`/api/inspections/${recordId}`);
        if (active) setRecord(data.record);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [recordId]);

  if (loading) return <section className="section-page inspection-page"><div className="empty">讀取巡檢紀錄中...</div></section>;

  const summary = record ? calculateInspectionSummary(record.items || []) : null;

  return (
    <section className="section-page inspection-page">
      <header className="inspection-page-head compact">
        <div>
          <h1>每日巡檢詳細</h1>
        </div>
        <div className="section-actions">
          <button onClick={() => router.push("/inspections")}>返回列表</button>
          {record ? <button className="primary-action" onClick={() => router.push(`/inspections/${record.id}/edit`)}>編輯</button> : null}
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}
      {!record ? <div className="empty">找不到巡檢紀錄</div> : (
        <>
          <section className={`inspection-detail-summary ${summary.abnormal_count > 0 || summary.observation_count > 0 ? "has-attention" : ""}`}>
            <div>
              <span>巡檢日期</span>
              <strong>{formatDate(record.inspection_date)}</strong>
            </div>
            <div>
              <span>巡檢人員</span>
              <strong>{record.inspector_name || "-"}</strong>
            </div>
            <div>
              <span>整體狀態</span>
              <InspectionStatusBadge value={summary.overall_status} />
            </div>
            <div>
              <span>正常</span>
              <strong>{summary.normal_count || 0}</strong>
            </div>
            <div>
              <span>異常</span>
              <strong>{summary.abnormal_count || 0}</strong>
            </div>
            <div>
              <span>待觀察</span>
              <strong>{summary.observation_count || 0}</strong>
            </div>
            <div>
              <span>最後更新</span>
              <strong>{formatUpdatedAt(record.updated_at)}</strong>
            </div>
            <p>{record.note || "無補充說明"}</p>
          </section>

          <section className="inspection-detail-items">
            <header>
              <h2>巡檢項目明細</h2>
              <span>{summary.item_count || record.items?.length || 0} 項</span>
            </header>
            <div className="inspection-item-list">
              {(record.items || []).map((item) => {
                const attention = needsIssueFields(item.status);
                return (
                  <article className={`inspection-item-card ${attention ? "needs-attention" : ""}`} key={item.id}>
                    <div className="inspection-item-head">
                      <div>
                        <span>{item.category}</span>
                        <h3>{item.item_name}</h3>
                      </div>
                      <InspectionStatusBadge value={item.status} type="item" />
                    </div>
                    {attention ? (
                      <div className="inspection-detail-issue">
                        <p><b>備註：</b>{item.issue_description || "-"}</p>
                        <p><b>處理狀態：</b><InspectionStatusBadge value={item.handling_status} type="handling" /></p>
                        <p><b>處理說明：</b>{item.handling_method || "-"}</p>
                        <p><b>附件：</b>{Array.isArray(item.attachments) && item.attachments.length ? item.attachments.join("、") : "-"}</p>
                      </div>
                    ) : null}
                    <p className="inspection-item-note">{item.note || "無補充備註"}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
