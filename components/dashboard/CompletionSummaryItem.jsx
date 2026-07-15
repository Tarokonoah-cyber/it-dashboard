export default function CompletionSummaryItem({ rate, completed, total }) {
  const normalized = Math.max(0, Math.min(100, Number(rate) || 0));
  const tone = normalized < 50 ? "warn" : normalized < 80 ? "neutral" : "good";

  return (
    <article className={`kpi-summary-item completion-summary ${tone}`}>
      <div className="kpi-summary-label">完成率</div>
      <div className="completion-summary-main">
        <strong className="completion-rate-mobile">{normalized}%</strong>
        <div className="kpi-donut" style={{ "--progress": `${normalized}%` }} aria-hidden="true">
          <span>{normalized}%</span>
        </div>
        <div className="completion-summary-copy">
          <span className="completion-count-line">已完成 {completed} / {total} 件</span>
        </div>
      </div>
    </article>
  );
}
