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
import { getWorkPriorityLabel } from "../lib/dashboard-metrics";
import { getLineRepairEventType, getLineRepairEventVersion, isLineRepairWork } from "../lib/lineRepairTask";

function ModernDashboardPage({ dashboard, onDashboardChange, error, loading, onRetry, onNavigate, notify }) {
  if (!dashboard) {
    return (
      <div className="modern-dashboard-page">
        <header className="section-head"><div><h1>儀表板</h1></div></header>
        <section className="panel dashboard-state-panel" role={error ? "alert" : "status"} aria-live="polite">
          <div className="dashboard-state-mark" aria-hidden="true">{error ? "!" : "…"}</div>
          <div>
            <h2>{loading ? "正在載入最新營運資料" : "儀表板暫時無法載入"}</h2>
            <p>{loading ? "請稍候，這通常只需要幾秒鐘。" : error || "請確認網路連線後再試一次。"}</p>
          </div>
          {!loading ? <button type="button" onClick={onRetry}>重新載入</button> : null}
        </section>
      </div>
    );
  }
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
  const [loading, setLoading] = useState(true);
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
    const initialLoad = !dashboardRef.current;
    if (initialLoad) setLoading(true);
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
      if (initialLoad) setLoading(false);
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
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") loadDashboard();
    }, 10000);
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
      <ModernDashboardPage
        dashboard={dashboard}
        onDashboardChange={updateDashboard}
        error={error}
        loading={loading}
        onRetry={() => loadDashboard({ announce: false })}
        onNavigate={handleNavigate}
        notify={notify}
      />
    </AppShell>
  );
}

