"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import CompletionSummaryItem from "./dashboard/CompletionSummaryItem";
import DashboardCalendarPanel from "./dashboard/DashboardCalendarPanel";
import DashboardToast from "./dashboard/DashboardToast";
import DashboardWorkPanel from "./dashboard/DashboardWorkPanel";
import KpiSummaryItem from "./dashboard/KpiSummaryItem";
import { getSectionHref } from "./navigation";
import { api } from "../lib/dashboard-api";
import {
  formatDate,
  formatRelativeDate
} from "../lib/dashboard-formatters";
import { getWorkPriorityLabel } from "../lib/dashboard-metrics";
import { getLineRepairEventType, getLineRepairEventVersion, isLineRepairWork } from "../lib/lineRepairTask";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || "").trim());
}

function formatWorkTitle(work) {
  const title = String(work.title || "").trim();
  const description = String(work.description || "").trim();
  if (/^\d+$/.test(title) && description) return description;
  return title || description || "未命名工作";
}

function DashboardWorkTable({ works, onNavigate }) {
  return (
    <section className="panel dashboard-recent-panel">
      <header className="panel-title">
        <div>
          <h2>最近工作紀錄</h2>
          <span>最新 4 筆</span>
        </div>
        <button className="panel-text-button" type="button" onClick={() => onNavigate?.("work")}>查看全部</button>
      </header>
      <div className="work-table dashboard-work-table">
        <div className="work-row head">
          <span>編號</span>
          <span>日期</span>
          <span>標題</span>
          <span>類型</span>
          <span>狀態</span>
        </div>
        {works.length ? works.slice(0, 4).map((work) => (
          <div className="work-row" key={work.id}>
            <span>{work.id || "-"}</span>
            <span title={formatDate(work.date || work.created_at)}>{formatRelativeDate(work.date || work.created_at)}</span>
            <strong>{formatWorkTitle(work)}</strong>
            <span>{work.category || work.type || "工作"}</span>
            <b className={isDoneStatus(work.status) ? "status-done" : "status-pending"}>{work.status || "待辦"}</b>
          </div>
        )) : <div className="empty">目前沒有工作紀錄</div>}
      </div>
    </section>
  );
}

function DashboardTrendPanel({ trend }) {
  const safeTrend = Array.isArray(trend) ? trend.slice(-7) : [];
  if (!safeTrend.some((item) => Number(item.count) > 0)) return null;
  const max = Math.max(1, ...safeTrend.map((item) => Number(item.count) || 0));
  const chartWidth = 700;
  const chartHeight = 154;
  const padX = 18;
  const padTop = 18;
  const padBottom = 24;
  const plotHeight = chartHeight - padTop - padBottom;
  const points = safeTrend.map((item, index) => {
    const count = Number(item.count) || 0;
    const x = safeTrend.length <= 1 ? padX : padX + (index / (safeTrend.length - 1)) * (chartWidth - padX * 2);
    const y = padTop + plotHeight - (count / max) * plotHeight;
    return { ...item, count, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = chartHeight - padBottom;
  const area = points.length ? `${padX},${baseline} ${polyline} ${chartWidth - padX},${baseline}` : "";

  return (
    <section className="panel dashboard-trend-panel">
      <header className="panel-title">
        <div>
          <h2>近 7 日新增工作</h2>
          <span>工作量趨勢</span>
        </div>
        <button className="panel-text-button" type="button">更多資料</button>
      </header>
      <svg className="line-chart dashboard-line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = padTop + plotHeight * ratio;
          return <line key={ratio} x1={padX} x2={chartWidth - padX} y1={y} y2={y} />;
        })}
        <polygon points={area} />
        <polyline points={polyline} />
        {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="2.8" />)}
      </svg>
      <div className="trend-labels" style={{ gridTemplateColumns: `repeat(${Math.max(safeTrend.length, 1)}, minmax(0, 1fr))` }}>
        {safeTrend.map((item) => (
          <span key={item.date}><b>{item.count}</b>{item.date.slice(5)}</span>
        ))}
      </div>
    </section>
  );
}

function ModernDashboardPage({ dashboard, onDashboardChange, error, onNavigate, notify }) {
  const works = dashboard?.openWorks || [];
  const followUps = dashboard?.followUps || [];
  const pendingCount = dashboard?.pendingCount ?? 0;
  const monthCompletedCount = dashboard?.monthCompletedCount ?? 0;
  const monthCompletionTotal = dashboard?.monthCompletionTotal ?? dashboard?.monthWorkCount ?? 0;
  const monthCompletionRate = dashboard?.monthCompletionRate ?? (monthCompletionTotal ? Math.round((monthCompletedCount / monthCompletionTotal) * 100) : 0);
  const importantWorkCount = dashboard?.importantCount ?? works.filter((work) => getWorkPriorityLabel(work) === "重要").length;

  return (
    <div className="modern-dashboard-page">
      <header className="section-head">
        <div>
          <h1>儀表板</h1>
        </div>
      </header>
      <section className="dashboard-kpi-strip">
        <section className="dashboard-kpi-summary" aria-label="今日營運指標">
          <KpiSummaryItem
            label="未完成工作"
            value={pendingCount}
            unit="件"
            tone={pendingCount > 0 ? "warn" : "good"}
          />
          <KpiSummaryItem
            label="本月工作"
            value={dashboard?.monthWorkCount ?? 0}
            unit="件"
            delta={dashboard?.deltas?.monthWork || "+0"}
            deltaLabel="較上月"
            tone="neutral"
            deltaImpact="neutral"
          />
          <KpiSummaryItem
            label="重要任務"
            value={importantWorkCount}
            unit="件"
            detail="優先處理"
            tone={importantWorkCount > 0 ? "warn" : "good"}
          />
          <CompletionSummaryItem
            label="本月完成率"
            rate={monthCompletionRate}
            completed={monthCompletedCount}
            total={monthCompletionTotal}
          />
        </section>
        <details className="mobile-month-kpi">
          <summary>查看本月工作統計</summary>
          <div>
            <span>本月累計</span>
            <strong>{dashboard?.monthWorkCount ?? 0}<small>件</small></strong>
            <em>{dashboard?.deltas?.monthWork || "+0"} 較上月</em>
          </div>
        </details>
      </section>
      {error ? <div className="error-box">{error}</div> : null}

      <section className="dashboard-layout modern-dashboard-layout">
        <DashboardWorkPanel
          works={works}
          followUps={followUps}
          onNavigate={onNavigate}
          notify={notify}
          onDashboardChange={onDashboardChange}
        />
        <DashboardCalendarPanel dashboard={dashboard} notify={notify} />
      </section>
    </div>
  );
}

function findLineRepairAnnouncements(previousDashboard, nextDashboard) {
  if (!previousDashboard) return [];
  const previousRows = Array.isArray(previousDashboard.openWorks) ? previousDashboard.openWorks : [];
  const nextRows = Array.isArray(nextDashboard?.openWorks) ? nextDashboard.openWorks : [];
  const previousById = new Map(previousRows.map((work) => [String(work.id), work]));

  return nextRows.filter((work) => {
    if (!isLineRepairWork(work)) return false;
    const eventType = getLineRepairEventType(work);
    if (!["repair.created", "repair.reopened"].includes(eventType)) return false;
    const previous = previousById.get(String(work.id));
    return !previous || getLineRepairEventVersion(previous) !== getLineRepairEventVersion(work);
  });
}

export default function Page() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const dashboardRef = useRef(null);
  const loadInFlightRef = useRef(false);

  const notify = useCallback(function notify(nextToast) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), tone: "success", ...nextToast });
    const duration = Math.max(1000, Number(nextToast?.duration) || 2600);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const loadDashboard = useCallback(async function loadDashboard(options = {}) {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setError("");
    try {
      const previous = dashboardRef.current;
      const next = await api("/api/dashboard");
      dashboardRef.current = next;
      setDashboard(next);
      if (options.announce !== false) {
        const announcements = findLineRepairAnnouncements(previous, next);
        if (announcements.length === 1) {
          const work = announcements[0];
          const reopened = getLineRepairEventType(work) === "repair.reopened";
          notify({
            tone: "success",
            duration: 4000,
            message: reopened
              ? `報修任務已重新開啟：${work.title || "未命名工作"}`
              : `收到新報修任務：${work.title || "未命名工作"}`
          });
        } else if (announcements.length > 1) {
          notify({ tone: "success", duration: 4000, message: `收到 ${announcements.length} 筆報修任務更新` });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      loadInFlightRef.current = false;
    }
  }, [notify]);

  const updateDashboard = useCallback((updater) => {
    setDashboard((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      dashboardRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    loadDashboard({ announce: false });
    const interval = window.setInterval(() => loadDashboard(), 10000);
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") loadDashboard();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboard]);

  useEffect(() => {
    function handleDashboardDataChanged() {
      loadDashboard({ announce: false });
    }
    window.addEventListener("dashboard-data-changed", handleDashboardDataChanged);
    return () => window.removeEventListener("dashboard-data-changed", handleDashboardDataChanged);
  }, [loadDashboard]);

  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (!requestedSection) return;
    const href = requestedSection === "kpi" ? "/boss-kpi" : getSectionHref(requestedSection);
    if (href !== "/") window.location.replace(href);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const mobileAction = url.searchParams.get("mobileAction");
    if (!mobileAction) return undefined;
    url.searchParams.delete("mobileAction");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("dashboard-mobile-action", { detail: { action: mobileAction } }));
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  function handleNavigate(sectionKey, item) {
    router.push(item?.href || (sectionKey === "kpi" ? "/boss-kpi" : getSectionHref(sectionKey)));
  }

  return (
    <AppShell activeSection="dashboard" title="儀表板" onNavigate={handleNavigate}>
      <DashboardToast toast={toast} />
      <ModernDashboardPage dashboard={dashboard} onDashboardChange={updateDashboard} error={error} onNavigate={handleNavigate} notify={notify} />
    </AppShell>
  );
}

