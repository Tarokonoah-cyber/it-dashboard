export const SIDEBAR_STORAGE_KEY = "it-dashboard-sidebar-state";

export const APP_SECTIONS = [
  { key: "dashboard", icon: "D", label: "儀表板", href: "/" },
  { key: "quick-notes", icon: "N", label: "快速筆記", href: "/quick-notes" },
  { key: "work", icon: "W", label: "工作中心", href: "/work" },
  { key: "follow-ups", icon: "F", label: "待追蹤", href: "/follow-ups" },
  { key: "daily_inspections", icon: "I", label: "每日巡檢", href: "/inspections" },
  { key: "documents", icon: "O", label: "文件中心", href: "/documents" },
  { key: "contacts", icon: "C", label: "聯絡資訊", href: "/contacts" },
  {
    key: "assets",
    icon: "A",
    label: "資產管理",
    href: "/assets",
    children: [
      { key: "assets_mountain_pc", label: "山上電腦", href: "/assets/mountain-pc" },
      { key: "assets_downhill_pc", label: "山下電腦", href: "/assets/downhill-pc" },
      { key: "assets_printer", label: "印表機", href: "/assets/printers" },
      { key: "it_incidents", label: "事件 / 異常紀錄", href: "/incidents" },
      { key: "assets_north_ya", label: "北亞", href: "/assets/north-ya" },
      { key: "assets_iptv", label: "IPTV", href: "/assets/iptv" }
    ]
  },
  {
    key: "contracts",
    icon: "K",
    label: "合約管理",
    href: "/contracts",
    children: [
      { key: "contracts_software", label: "軟體合約", href: "/contracts/software" },
      { key: "contracts_mobile", label: "行動門號", href: "/contracts/mobile" }
    ]
  },
  { key: "passwords", icon: "P", label: "密碼管理", href: "/passwords" },
  { key: "anydesk", icon: "R", label: "AnyDesk List", href: "/anydesk" },
  {
    key: "sop",
    icon: "S",
    label: "SOP 文件",
    href: "/sop",
    children: [
      { key: "sop_docs", label: "SOP", href: "/sop/docs" },
      { key: "soc_docs", label: "SOC", href: "/sop/soc" }
    ]
  },
  { key: "settings", icon: "G", label: "設定", href: "/settings" }
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
