"use client";

import { useEffect, useState } from "react";

export default function WorkCompletionDialog({ work, related = [], defaultDate, loading, saving, onCancel, onConfirm }) {
  const [closeRelated, setCloseRelated] = useState(false);
  const [nextFollowDate, setNextFollowDate] = useState(defaultDate || "");

  useEffect(() => {
    setCloseRelated(false);
    setNextFollowDate(defaultDate || "");
  }, [defaultDate, work?.id]);

  if (!work) return null;
  const hasRelated = related.length > 0;
  const disabled = Boolean(loading || saving);

  function submit(mode) {
    if (mode === "follow_up" && !hasRelated && !nextFollowDate) return;
    onConfirm?.({ mode, closeRelated, nextFollowDate });
  }

  return (
    <div className="work-completion-backdrop" role="presentation" onMouseDown={() => !disabled && onCancel?.()}>
      <section className="work-completion-dialog" role="dialog" aria-modal="true" aria-labelledby="work-completion-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>完成任務</span>
            <h2 id="work-completion-title">{work.title || "未命名工作"}</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={disabled} aria-label="關閉">×</button>
        </header>

        {loading ? <div className="work-completion-loading">正在檢查相關待追蹤事項…</div> : (
          <div className="work-completion-body">
            {hasRelated ? (
              <div className="work-related-follow-ups">
                <strong>找到 {related.length} 筆相關待追蹤</strong>
                <ul>
                  {related.slice(0, 4).map((row) => <li key={row.id}>{row.title}</li>)}
                </ul>
                <label>
                  <input type="checkbox" checked={closeRelated} onChange={(event) => setCloseRelated(event.target.checked)} />
                  完成工作時，一併關閉以上追蹤事項
                </label>
              </div>
            ) : (
              <p>這筆工作要直接結案，還是轉成待追蹤後繼續提醒？</p>
            )}

            {!hasRelated ? (
              <label className="work-completion-date">
                下次追蹤日期
                <input type="date" value={nextFollowDate} onChange={(event) => setNextFollowDate(event.target.value)} />
              </label>
            ) : (
              <p className="work-completion-hint">選擇保留追蹤時，現有追蹤事項會繼續依原日期提醒。</p>
            )}
          </div>
        )}

        <footer>
          <button type="button" onClick={onCancel} disabled={disabled}>取消</button>
          <button className="work-follow-up-action" type="button" onClick={() => submit("follow_up")} disabled={disabled || (!hasRelated && !nextFollowDate)}>
            {hasRelated ? "完成並保留追蹤" : "轉為待追蹤"}
          </button>
          <button className="primary-action" type="button" onClick={() => submit("complete")} disabled={disabled}>
            {saving ? "處理中…" : "完成並結案"}
          </button>
        </footer>
      </section>
    </div>
  );
}
