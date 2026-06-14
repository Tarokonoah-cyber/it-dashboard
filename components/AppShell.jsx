"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AiCommandAssistant from "./AiCommandAssistant";

const SIDEBAR_STORAGE_KEY = "it-dashboard-sidebar-state";

export const APP_SECTIONS = [
  { key: "dashboard", icon: "📊", label: "儀表板", href: "/" },
  { key: "quick-notes", icon: "📝", label: "快速備忘錄", href: "/quick-notes" },
  { key: "work", icon: "🧾", label: "工作中心", href: "/work" },
  { key: "documents", icon: "🗂️", label: "送交單據紀錄", href: "/documents" },
  { key: "contacts", icon: "📒", label: "通訊錄", href: "/contacts" },
  {
    key: "assets",
    icon: "🖥️",
    label: "設備清單",
    href: "/assets",
    children: [
      { key: "assets_mountain_pc", label: "山上電腦", href: "/assets/mountain-pc" },
      { key: "assets_downhill_pc", label: "山下電腦", href: "/assets/downhill-pc" },
      { key: "assets_printer", label: "印表機", href: "/assets/printers" },
      { key: "assets_north_ya", label: "北YA", href: "/assets/north-ya" },
      { key: "assets_iptv", label: "IPTV", href: "/assets/iptv" }
    ]
  },
  {
    key: "contracts",
    icon: "📑",
    label: "合約總覽",
    href: "/contracts",
    children: [
      { key: "contracts_software", label: "軟體合約", href: "/contracts/software" },
      { key: "contracts_mobile", label: "行動電話約期", href: "/contracts/mobile" }
    ]
  },
  { key: "passwords", icon: "🔐", label: "密碼索引", href: "/passwords" },
  { key: "anydesk", icon: "🪪", label: "AnyDesk List", href: "/anydesk" },
  {
    key: "sop",
    icon: "📚",
    label: "SOP 文件",
    href: "/sop",
    children: [
      { key: "sop_docs", label: "SOP", href: "/sop/docs" },
      { key: "soc_docs", label: "SOC", href: "/sop/soc" }
    ]
  },
  { key: "settings", icon: "⚙️", label: "設定", href: "/settings" }
];

export const FLAT_APP_SECTIONS = APP_SECTIONS.flatMap((item) => [item, ...(item.children || [])]);

export function taipeiNowLabel() {
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date());
}

function navigateTo(item, onNavigate, router) {
  if (!item) return;
  if (onNavigate) {
    onNavigate(item.key, item);
    return;
  }
  router.push(item.href || "/");
}

function ShellSidebar({ activeSection, onNavigate, collapsed, onToggle, router }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(["assets", "contracts", "sop"]));

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

  function toggleGroup(item) {
    if (collapsed) {
      onToggle();
      return;
    }
    toggleGroupOpen(item);
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="brand-row">
          <div className="brand-mark">IT</div>
          {!collapsed && (
            <div className="brand-copy">
              <h1>資訊後台</h1>
              <p>Operations Control Center</p>
            </div>
          )}
          <button className="collapse-btn" aria-label="切換側邊欄" onClick={onToggle}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        {!collapsed && <div className="nav-label">主選單</div>}
      </div>
      <nav className="side-nav">
        {APP_SECTIONS.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const expanded = openGroups.has(item.key);
          const groupActive = isGroupActive(item);
          return (
            <div className="nav-group" key={item.key}>
              <button
                type="button"
                className={`nav-item ${groupActive ? "active" : ""} ${hasChildren ? "has-children" : ""}`}
                onClick={() => (hasChildren ? toggleGroup(item) : navigateTo(item, onNavigate, router))}
                title={item.label}
              >
                <span
                  className="nav-icon"
                  onClick={(event) => {
                    if (!hasChildren) return;
                    event.stopPropagation();
                    navigateTo(item, onNavigate, router);
                  }}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                  <span
                    onClick={(event) => {
                      if (!hasChildren) return;
                      event.stopPropagation();
                      navigateTo(item, onNavigate, router);
                    }}
                  >
                    {item.label}
                  </span>
                )}
                {!collapsed && hasChildren && <span className={`nav-caret ${expanded ? "open" : ""}`}>⌄</span>}
              </button>
              {!collapsed && hasChildren && expanded && (
                <div className="nav-children">
                  {item.children.map((child) => (
                    <button
                      key={child.key}
                      type="button"
                      className={`nav-child ${activeSection === child.key ? "active" : ""}`}
                      onClick={() => navigateTo(child, onNavigate, router)}
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
      {!collapsed && (
        <div className="sidebar-foot">
          <span>Vercel Web App</span>
          <span>Supabase Fast Dashboard</span>
        </div>
      )}
    </aside>
  );
}

export default function AppShell({ activeSection = "dashboard", title, children, onNavigate }) {
  const [collapsed, setCollapsed] = useState(true);
  const router = useRouter();
  const currentTitle = useMemo(
    () => title || FLAT_APP_SECTIONS.find((item) => item.key === activeSection)?.label || "儀表板",
    [activeSection, title]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "expanded") setCollapsed(false);
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
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
      />
      <section className="main-area">
        <header className="app-header">
          <div className="app-header-title">
            <h2>{currentTitle}</h2>
            <p>今日日期：{taipeiNowLabel()}</p>
          </div>
          <div className="app-header-actions">
            <span className="online-dot">System Online</span>
          </div>
        </header>
        {children}
      </section>
      <AiCommandAssistant />
    </main>
  );
}
