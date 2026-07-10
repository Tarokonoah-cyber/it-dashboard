import { parseDelta } from "../../lib/dashboard-formatters";

export default function KpiSummaryItem({ label, value, unit = "", delta, deltaLabel = "", detail = "", tone = "neutral", deltaImpact = "neutral" }) {
  const parsedDelta = parseDelta(delta);
  const deltaTone = parsedDelta.direction === "flat" ? "flat" : deltaImpact;

  return (
    <article className={`kpi-summary-item ${tone}`}>
      <div className="kpi-summary-label">{label}</div>
      <div className="kpi-summary-main">
        <strong>{value}<small>{unit}</small></strong>
      </div>
      <div className="kpi-summary-meta">
        {deltaLabel ? (
          <span className={`kpi-delta ${deltaTone}`}>
            {parsedDelta.text}
            <small>{deltaLabel}</small>
          </span>
        ) : null}
        {detail ? <span>{detail}</span> : null}
      </div>
    </article>
  );
}
