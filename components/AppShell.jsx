"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  APP_SECTIONS,
  SIDEBAR_STORAGE_KEY,
  getInitialOpenGroups,
  getParentSectionKey,
  getSectionHref
} from "./navigation";

const MOBILE_DASHBOARD_EVENT = "dashboard-mobile-action";
const MOBILE_SECTION_GROUPS = new Map([
  ["dashboard", "每日工作"],
  ["documents", "資產設備"],
  ["passwords", "文件工具"],
  ["settings", "系統設定"]
]);

const AiCommandAssistant = dynamic(
  () => import("./AiCommandAssistant"),
  {
    ssr: false,
    loading: () => null
  }
);

function navigateTo(item, onNavigate, router) {
  if (!item) return;
  if (onNavigate) {
    onNavigate(item.key, item);
    return;
  }
  router.push(item.href || getSectionHref(item.key));
}

function ShellSidebar({ activeSection, onNavigate, collapsed, onToggle, router, mobileOpen, onCloseMobile }) {
  const [openGroups, setOpenGroups] = useState(() => getInitialOpenGroups(activeSection));

  useEffect(() => {
    const parentKey = getParentSectionKey(activeSection);
    setOpenGroups((current) => {
      const next = new Set(current);
      APP_SECTIONS.forEach((item) => {
        if (item.children?.length && item.key !== parentKey) next.delete(item.key);
      });
      if (parentKey) next.add(parentKey);
      return next;
    });
  }, [activeSection]);

  function isGroupActive(item) {
    return item.key === activeSection || item.children?.some((child) => child.key === activeSection);
  }

  function toggleGroupOpen(item) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      return next;
    });
  }

  function handleParentClick(item) {
    if (collapsed) {
      onToggle();
      return;
    }
    toggleGroupOpen(item);
  }

  function handleNavigate(item) {
    navigateTo(item, onNavigate, router);
    onCloseMobile?.();
  }

  return (
    <>
      <button
        className={`sidebar-backdrop ${mobileOpen ? "show" : ""}`}
        type="button"
        aria-label="關閉選單"
        onClick={onCloseMobile}
      />
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">T</div>
            {!collapsed && (
              <div className="brand-copy">
                <h1>資訊管理平台</h1>
              </div>
            )}
          </div>
        </div>

        <nav className="side-nav" aria-label="主選單">
          {APP_SECTIONS.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const expanded = !collapsed && openGroups.has(item.key);
            const groupActive = isGroupActive(item);
            return (
              <div className="nav-group" key={item.key}>
                {MOBILE_SECTION_GROUPS.has(item.key) ? (
                  <p className="mobile-nav-group-label">{MOBILE_SECTION_GROUPS.get(item.key)}</p>
                ) : null}
                <button
                  type="button"
                  className={`nav-item ${groupActive ? "active" : ""} ${hasChildren ? "has-children" : ""}`}
                  onClick={() => (hasChildren ? handleParentClick(item) : handleNavigate(item))}
                  title={item.label}
                  aria-expanded={hasChildren && !collapsed ? expanded : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  {!collapsed && <span className="nav-text">{item.label}</span>}
                  {!collapsed && hasChildren && <span className={`nav-caret ${expanded ? "open" : ""}`} aria-hidden="true">›</span>}
                </button>
                {hasChildren && expanded && (
                  <div className="nav-children">
                    {item.children.map((child) => (
                      <button
                        key={child.key}
                        type="button"
                        className={`nav-child ${activeSection === child.key ? "active" : ""}`}
                        onClick={() => handleNavigate(child)}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-control">
          <button className="collapse-btn" type="button" aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"} onClick={onToggle}>
            {collapsed ? "›" : "‹"}
            {!collapsed && <span>收合選單</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export default function AppShell({
  activeSection = "dashboard",
  children,
  onNavigate,
  defaultSidebarCollapsed = false,
  sidebarStorageScope = ""
}) {
  const pageSidebarStorageKey = sidebarStorageScope ? `${SIDEBAR_STORAGE_KEY}:${sidebarStorageScope}` : "";
  const [collapsed, setCollapsed] = useState(defaultSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (pageSidebarStorageKey) {
      const pageSaved = window.localStorage.getItem(pageSidebarStorageKey);
      if (pageSaved === "expanded") {
        setCollapsed(false);
        return;
      }
      if (pageSaved === "collapsed") {
        setCollapsed(true);
        return;
      }
    }
    if (defaultSidebarCollapsed) {
      setCollapsed(true);
      return;
    }
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "expanded") setCollapsed(false);
    if (saved === "collapsed") setCollapsed(true);
  }, [defaultSidebarCollapsed, pageSidebarStorageKey]);

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      const storedValue = next ? "collapsed" : "expanded";
      if (pageSidebarStorageKey) window.localStorage.setItem(pageSidebarStorageKey, storedValue);
      else window.localStorage.setItem(SIDEBAR_STORAGE_KEY, storedValue);
      return next;
    });
  }

  useEffect(() => {
    if (!mobileOpen && !quickAddOpen) return undefined;
    function handleEscape(event) {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      setQuickAddOpen(false);
    }
    document.body.classList.add("mobile-overlay-open");
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("mobile-overlay-open");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen, quickAddOpen]);

  function runDashboardAction(action) {
    setQuickAddOpen(false);
    setMobileOpen(false);
    if (activeSection === "dashboard") {
      window.dispatchEvent(new CustomEvent(MOBILE_DASHBOARD_EVENT, { detail: { action } }));
      return;
    }
    router.push(`/?mobileAction=${encodeURIComponent(action)}`);
  }

  return (
    <main className={`app-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <ShellSidebar
        activeSection={activeSection}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        router={router}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <section className="main-area">
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="開啟選單"
          onClick={() => {
            setCollapsed(false);
            setMobileOpen(true);
          }}
        >
          ☰
        </button>
        {children}
      </section>
      <nav className="mobile-bottom-nav" aria-label="手機快捷導覽">
        <button type="button" className={activeSection === "dashboard" ? "active" : ""} onClick={() => router.push("/")}>
          <span aria-hidden="true">⌂</span>
          <b>首頁</b>
        </button>
        <button type="button" onClick={() => runDashboardAction("today")}>
          <span aria-hidden="true">◎</span>
          <b>今日</b>
        </button>
        <button className="mobile-bottom-add" type="button" aria-label="開啟快速新增" onClick={() => setQuickAddOpen(true)}>
          <span aria-hidden="true">＋</span>
          <b>新增</b>
        </button>
        <button type="button" onClick={() => runDashboardAction("calendar")}>
          <span aria-hidden="true">▦</span>
          <b>月曆</b>
        </button>
        <button type="button" aria-expanded={mobileOpen} onClick={() => {
          setCollapsed(false);
          setMobileOpen(true);
        }}>
          <span aria-hidden="true">☰</span>
          <b>更多</b>
        </button>
      </nav>
      {quickAddOpen ? (
        <div className="mobile-quick-add-backdrop" role="presentation" onMouseDown={() => setQuickAddOpen(false)}>
          <section className="mobile-quick-add-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-quick-add-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>快速建立</span>
                <h2 id="mobile-quick-add-title">新增工作項目</h2>
              </div>
              <button type="button" aria-label="關閉快速新增" onClick={() => setQuickAddOpen(false)}>×</button>
            </header>
            <button type="button" onClick={() => runDashboardAction("add-work")}>
              <span aria-hidden="true">☑</span>
              <strong>新增任務</strong>
              <small>直接加入工作中心並顯示在首頁</small>
            </button>
            <button type="button" onClick={() => runDashboardAction("add-calendar")}>
              <span aria-hidden="true">▦</span>
              <strong>新增行程</strong>
              <small>加入指定日期的行事曆</small>
            </button>
            <button type="button" onClick={() => {
              setQuickAddOpen(false);
              router.push("/follow-ups");
            }}>
              <span aria-hidden="true">↗</span>
              <strong>待追蹤</strong>
              <small>前往待追蹤工作頁面</small>
            </button>
          </section>
        </div>
      ) : null}
      <AiCommandAssistant />
    </main>
  );
}
