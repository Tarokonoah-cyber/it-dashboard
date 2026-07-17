export const SIDEBAR_STORAGE_KEY = "it-dashboard-sidebar-state";

export const APP_SECTIONS = [
  { key: "dashboard", icon: "⌂", label: "儀表板", href: "/" },
  { key: "quick-notes", icon: "✎", label: "快速備忘錄", href: "/quick-notes" },
  {
    key: "work-center",
    icon: "□",
    label: "工作中心",
    href: "/work",
    children: [
      { key: "work", label: "工作紀錄", href: "/work" },
      { key: "follow-ups", label: "待追蹤", href: "/follow-ups" },
      { key: "recurring_tasks", label: "週期任務", href: "/work/recurring" }
    ]
  },
  { key: "daily_inspections", icon: "☑", label: "每日巡檢", href: "/inspections" },
  { key: "documents", icon: "▤", label: "送交單據紀錄", href: "/documents" },
  { key: "contacts", icon: "☷", label: "通訊錄", href: "/contacts" },
  {
    key: "assets",
    icon: "▣",
    label: "設備清單",
    href: "/assets",
    children: [
      { key: "assets_mountain_pc", label: "山上電腦", href: "/assets/mountain-pc" },
      { key: "assets_downhill_pc", label: "山下電腦", href: "/assets/downhill-pc" },
      { key: "assets_printer", label: "印表機", href: "/assets/printers" },
      { key: "it_incidents", label: "故障總表 / 異常事件紀錄", href: "/incidents" },
      { key: "assets_north_ya", label: "北 YA", href: "/assets/north-ya" },
      { key: "assets_iptv", label: "IPTV", href: "/assets/iptv" }
    ]
  },
  {
    key: "contracts",
    icon: "◇",
    label: "合約管理",
    href: "/contracts",
    children: [
      { key: "contracts_software", label: "軟體合約", href: "/contracts/software" },
      { key: "contracts_mobile", label: "手機門號合約", href: "/contracts/mobile" }
    ]
  },
  { key: "passwords", icon: "◈", label: "密碼管理", href: "/passwords" },
  { key: "reports", icon: "▧", label: "報表中心", href: "/reports" },
  { key: "anydesk", icon: "⌘", label: "AnyDesk List", href: "/anydesk" },
  {
    key: "sop",
    icon: "▥",
    label: "SOP 文件",
    href: "/sop",
    children: [
      { key: "sop_docs", label: "SOP", href: "/sop/docs" },
      { key: "soc_docs", label: "SOC", href: "/sop/soc" }
    ]
  },
  { key: "settings", icon: "⚙", label: "設定", href: "/settings" }
];

export const FLAT_APP_SECTIONS = APP_SECTIONS.flatMap((item) => [item, ...(item.children || [])]);

export const ROUTE_MAP = FLAT_APP_SECTIONS.reduce((map, item) => {
  map[item.key] = item.href || "/";
  return map;
}, {});

export function getSectionByKey(key) {
  return FLAT_APP_SECTIONS.find((item) => item.key === key);
}

export function getParentSectionKey(key) {
  const parent = APP_SECTIONS.find((item) => item.children?.some((child) => child.key === key));
  return parent?.key || null;
}

export function getInitialOpenGroups(activeSection) {
  const parentKey = getParentSectionKey(activeSection);
  return parentKey ? new Set([parentKey]) : new Set();
}

export function getSectionHref(key) {
  return ROUTE_MAP[key] || "/";
}
