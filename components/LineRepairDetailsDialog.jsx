"use client";

import { useEffect } from "react";

export default function LineRepairDetailsDialog({ work, onClose }) {
  useEffect(() => {
    if (!work) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, work]);

  if (!work) return null;
  const repair = work?.external_data?.repair || {};
  const detailRows = [
    ["報修單號", repair.repairNo || work.source_id],
    ["地點", repair.location],
    ["報修單位", repair.reporterUnit],
    ["分類", [repair.categoryName, repair.category, repair.itemName].filter(Boolean).join(" · ")],
    ["負責人", repair.assignee]
  ].filter(([, value]) => String(value || "").trim());

  return (
    <div className="work-completion-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="work-completion-dialog line-repair-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="line-repair-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>報修單詳情</span>
            <h2 id="line-repair-detail-title">{work.title || "未命名工作"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </header>
        <div className="line-repair-detail-body">
          {detailRows.length ? (
            <dl>
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <section>
            <h3>問題描述</h3>
            <p>{repair.description || work.description || "未提供描述"}</p>
          </section>
          {repair.note ? (
            <section>
              <h3>備註</h3>
              <p>{repair.note}</p>
            </section>
          ) : null}
        </div>
        <footer>
          <button className="primary-action" type="button" onClick={onClose}>關閉</button>
        </footer>
      </section>
    </div>
  );
}
