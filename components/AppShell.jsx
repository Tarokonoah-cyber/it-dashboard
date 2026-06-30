"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AiCommandAssistant from "./AiCommandAssistant";
import {
  APP_SECTIONS,
  SIDEBAR_STORAGE_KEY,
  getInitialOpenGroups,
  getParentSectionKey,
  getSectionHref
} from "./navigation";

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
        <header className="app-header">
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
          <div className="app-header-actions">
            <span className="online-dot">系統正常</span>
            <span className="user-chip"><span>A</span><b>Admin</b></span>
          </div>
        </header>
        {children}
      </section>
      <AiCommandAssistant />
    </main>
  );
}
