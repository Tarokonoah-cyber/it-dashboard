import { createHmac } from "node:crypto";

export const MOBILE_VIEWPORTS = [
  { key: "360x800", width: 360, height: 800 },
  { key: "375x667", width: 375, height: 667 },
  { key: "393x852", width: 393, height: 852 },
  { key: "430x932", width: 430, height: 932 },
  { key: "412x915", width: 412, height: 915 },
  { key: "768x1024", width: 768, height: 1024 }
];

export const USER_ROUTES = [
  { path: "/", slug: "dashboard", label: "Dashboard" },
  { path: "/quick-notes", slug: "quick-notes", label: "Quick Notes" },
  { path: "/work", slug: "work", label: "Work Center" },
  { path: "/follow-ups", slug: "follow-ups", label: "Follow-ups" },
  { path: "/work/recurring", slug: "recurring-tasks", label: "Recurring Tasks" },
  { path: "/inspections", slug: "inspections", label: "Inspections" },
  { path: "/inspections/new", slug: "inspection-new", label: "New Inspection" },
  { path: "/inspections/qa-inspection", slug: "inspection-detail", label: "Inspection Detail" },
  { path: "/inspections/qa-inspection/edit", slug: "inspection-edit", label: "Edit Inspection" },
  { path: "/documents", slug: "documents", label: "Documents" },
  { path: "/contacts", slug: "contacts", label: "Contacts" },
  { path: "/assets", slug: "assets", label: "Assets" },
  { path: "/assets/mountain-pc", slug: "assets-mountain-pc", label: "Mountain PCs" },
  { path: "/assets/downhill-pc", slug: "assets-downhill-pc", label: "Downhill PCs" },
  { path: "/assets/printers", slug: "assets-printers", label: "Printers" },
  { path: "/assets/north-ya", slug: "assets-north-ya", label: "North YA" },
  { path: "/assets/iptv", slug: "assets-iptv", label: "IPTV" },
  { path: "/incidents", slug: "knowledge", label: "Knowledge" },
  { path: "/contracts", slug: "contracts", label: "Contracts" },
  { path: "/contracts/software", slug: "contracts-software", label: "Software Contracts" },
  { path: "/contracts/mobile", slug: "contracts-mobile", label: "Mobile Contracts" },
  { path: "/passwords", slug: "passwords", label: "Passwords" },
  { path: "/reports", slug: "reports", label: "Reports" },
  { path: "/cost-control", slug: "cost-control", label: "Cost Control" },
  { path: "/anydesk", slug: "anydesk", label: "AnyDesk" },
  { path: "/sop", slug: "sop", label: "SOP" },
  { path: "/sop/docs", slug: "sop-docs", label: "SOP Documents" },
  { path: "/sop/soc", slug: "soc-docs", label: "SOC Documents" },
  { path: "/settings", slug: "settings", label: "Settings" },
  { path: "/notifications", slug: "notifications", label: "Notifications" },
  { path: "/calendar", slug: "calendar", label: "Sports Calendar" },
  { path: "/boss-kpi", slug: "boss-kpi", label: "Boss KPI" },
  { path: "/offline", slug: "offline", label: "Offline" },
  { path: "/login", slug: "login", label: "Login", public: true }
];

export const REGRESSION_ROUTES = [
  "dashboard",
  "quick-notes",
  "work",
  "follow-ups",
  "recurring-tasks",
  "inspections",
  "inspection-new",
  "documents",
  "contacts",
  "assets",
  "knowledge",
  "contracts-software",
  "contracts-mobile",
  "passwords",
  "reports",
  "cost-control",
  "calendar",
  "settings",
  "notifications"
];

const FIXED_NOW = "2026-08-13T09:30:00+08:00";
const SESSION_SECRET = "mobile-qa-local-session-secret-2026-08-13-safe";

const workRows = [
  {
    id: "work-1",
    title: "確認宴會廳網路與投影設備，並回覆活動窗口",
    summary: "確認宴會廳網路與投影設備，並回覆活動窗口",
    category: "設備維護",
    work_type: "設備維護",
    system: "網路",
    department: "資訊室",
    status: "進行中",
    priority: "重要",
    work_date: "2026-08-13",
    due_date: "2026-08-13",
    note: "需要跨部門確認；這是一段足以測試中文換行與卡片寬度的說明。"
  },
  {
    id: "work-2",
    title: "更新櫃台備援電腦的安全性修補程式",
    summary: "更新櫃台備援電腦的安全性修補程式",
    category: "系統維護",
    work_type: "系統維護",
    system: "Windows",
    department: "資訊室",
    status: "待處理",
    priority: "一般",
    work_date: "2026-08-14",
    due_date: "2026-08-14"
  }
];

const followUps = [
  {
    id: "follow-1",
    title: "追蹤供應商修復客房 IPTV 連線",
    description: "供應商案件編號 VENDOR-2026-VERY-LONG-REFERENCE-000123",
    status: "待追蹤",
    priority: "重要",
    due_date: "2026-08-13",
    created_at: "2026-08-12T08:00:00+08:00"
  },
  {
    id: "follow-2",
    title: "確認印表機耗材交期",
    description: "採購已回覆，等待到貨日期。",
    status: "已完成",
    priority: "一般",
    due_date: "2026-08-12",
    completed_at: "2026-08-12T16:00:00+08:00"
  }
];

const recurringTasks = [
  {
    id: "recurring-1",
    title: "每週檢查備份與還原紀錄",
    recurrence: "weekly",
    weekday: 5,
    due_time: "09:00",
    category: "備份",
    enabled: true,
    next_due_date: "2026-08-14"
  }
];

const inspectionItems = [
  { id: "inspection-item-1", period: "daily", category: "網路", item_name: "核心交換器連線狀態", status: "正常", note: "運作正常", attachments: [] },
  { id: "inspection-item-2", period: "daily", category: "機房", item_name: "機房溫度與告警", status: "待觀察", issue_description: "溫度接近警戒值", handling_status: "處理中", handling_method: "持續監控空調", attachments: [] },
  { id: "inspection-item-3", period: "monthly", category: "備份", item_name: "還原演練", status: "正常", note: "測試完成", attachments: [] }
];

const inspectionRecord = {
  id: "qa-inspection",
  inspection_date: "2026-08-13",
  inspector_name: "QA 測試人員",
  note: "自動化視覺測試固定資料",
  overall_status: "待觀察",
  item_count: 3,
  normal_count: 2,
  abnormal_count: 0,
  observation_count: 1,
  unchecked_count: 0,
  updated_at: "2026-08-13T09:00:00+08:00",
  items: inspectionItems
};

const recordData = {
  id: "record-1",
  department: "資訊室",
  title: "資訊專員",
  name: "王小明",
  extension: "1234",
  phone: "0912-345-678",
  email: "mobile.visual.qa+long-address@example.com",
  asset_type: "桌上型電腦",
  asset_name: "FRONT-DESK-BACKUP-COMPUTER-WITH-A-LONG-NAME",
  computer_name: "FD-BACKUP-001",
  user_name: "櫃台備援",
  ip_address: "192.168.100.200",
  mac_address: "AA:BB:CC:DD:EE:FF",
  model: "Business Desktop Model 2026",
  monitor_model: "Wide Monitor 27-inch",
  windows_version: "Windows 11 Pro",
  status: "使用中",
  note: "這是一筆固定的代表性資料，用來驗證長文字、Email、ID 與表格在小螢幕的呈現。",
  updated_at: "2026-08-13T09:00:00+08:00",
  anydesk_id: "123 456 789",
  password: "••••••••",
  last_checked_at: "2026-08-13T09:00:00+08:00",
  contract_name: "年度資訊設備維護與技術支援服務合約",
  vendor: "範例科技股份有限公司",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  amount: 480000,
  owner: "資訊室",
  phone_no: "0912-345-678",
  short_code: "5566",
  carrier: "中華電信",
  plan: "企業行動方案",
  sop_id: "SOP-IT-001",
  sop_name: "機房日常巡檢標準作業程序",
  category: "基礎設施",
  system_name: "機房",
  version: "2.1"
};

const knowledgeArticle = {
  id: "qa-article",
  title: "無法連線時的網路快速排查流程",
  category: "網路",
  system: "基礎設施",
  status: "published",
  summary: "依序確認實體連線、IP 設定、閘道與 DNS，並記錄排查結果。",
  keywords: "網路,連線,DNS,故障排除",
  updated_at: "2026-08-13T09:00:00+08:00",
  steps: [
    { id: "step-1", step_order: 1, title: "確認連接狀態", content: "檢查網路線、交換器燈號與裝置連線狀態。", assets: [] },
    { id: "step-2", step_order: 2, title: "確認網路設定", content: "記錄 IP、閘道與 DNS；長值 https://support.example.com/network/troubleshooting/reference/very-long-path", assets: [] }
  ]
};

const costControlData = {
  setupRequired: false,
  meta: { dataYear: 2026, dataMonth: 8, lastImportedAt: "2026-08-13T08:00:00+08:00", filename: "Cost-Control-QA.xlsx", sourceType: "excel", warningCount: 0 },
  selection: { year: 2026, throughMonth: 8 },
  options: { years: [2026, 2025], months: [1, 2, 3, 4, 5, 6, 7, 8], departments: ["資訊室", "客務部"] },
  summary: { budget: 1200000, actual: 645000, committed: 120000, available: 435000, executionRate: 63.75, status: { key: "normal", label: "正常", icon: "✓" } },
  trend: [
    { label: "1月", monthly: 68000, cumulative: 68000 },
    { label: "2月", monthly: 72000, cumulative: 140000 },
    { label: "3月", monthly: 95000, cumulative: 235000 },
    { label: "4月", monthly: 88000, cumulative: 323000 },
    { label: "5月", monthly: 76000, cumulative: 399000 },
    { label: "6月", monthly: 92000, cumulative: 491000 },
    { label: "7月", monthly: 81000, cumulative: 572000 },
    { label: "8月", monthly: 73000, cumulative: 645000 }
  ],
  items: [
    { id: "budget-1", budgetCode: "A26-MIS001", itemName: "核心網路設備維護與授權", department: "資訊室", budgetAmount: 600000, actualAmount: 360000, committedAmount: 60000, availableAmount: 180000, executionRate: 70, status: { key: "normal", label: "正常" }, sourceSheetName: "2026 Budget" },
    { id: "budget-2", budgetCode: "A26-MIS002", itemName: "資訊安全教育訓練與外部稽核", department: "資訊室", budgetAmount: 600000, actualAmount: 285000, committedAmount: 60000, availableAmount: 255000, executionRate: 57.5, status: { key: "normal", label: "正常" }, sourceSheetName: "2026 Budget" }
  ],
  vouchers: [
    { id: "voucher-1", voucherNumber: "V202608130001", requestDate: "2026-08-13", accountCode: "610100", accountName: "維修費", description: "核心交換器年度技術支援服務", amount: 120000, department: "資訊室", budgetCode: "A26-MIS001", month: 8 }
  ],
  monthlyAmounts: [],
  sourceSheets: ["2026 Budget"]
};

const notificationSnapshot = {
  summary: { total: 2, unread: 2, snoozed: 0, critical: 1, categories: { work: 1, contract: 1 } },
  categories: [{ key: "work", label: "工作" }, { key: "contract", label: "合約" }],
  line: { configured: false },
  items: [
    { key: "notice-1", source_type: "work", category_label: "工作", severity: "critical", icon: "!", title: "重要工作今天到期", description: "請確認宴會廳網路與投影設備。", due_date: "2026-08-13", href: "/work", is_read: false, is_snoozed: false },
    { key: "notice-2", source_type: "contract", category_label: "合約", severity: "high", icon: "合", title: "維護合約即將到期", description: "請在到期日前完成續約評估。", due_date: "2026-08-30", href: "/contracts/software", is_read: false, is_snoozed: false }
  ]
};

function dashboardFixture() {
  return {
    openWorks: workRows,
    followUps,
    pendingCount: workRows.length,
    completedCount: 16,
    importantCount: 1,
    todayWorkCount: 5,
    monthWorkCount: 24,
    monthCompletedCount: 16,
    monthCompletionTotal: 24,
    monthCompletionRate: 67,
    completionRate: 67,
    deltas: { monthWork: "+3", pending: "+1" },
    networkRooms: [{ room_no: "305" }, { room_no: "608" }],
    contractReminders: [{ id: "contract-reminder-1", contract_name: "網路設備維護", end_date: "2026-08-30" }],
    warnings: []
  };
}

function reportFixture() {
  return {
    rows: workRows.map((row) => ({
      id: row.id,
      workDate: row.work_date,
      summary: row.title,
      workType: row.work_type,
      system: row.system,
      department: row.department,
      status: row.status
    })),
    totalRows: workRows.length,
    summary: { total: 24, completed: 16, open: 8, completionRate: 67 },
    options: { workTypes: ["設備維護", "系統維護"], systems: ["網路", "Windows"], departments: ["資訊室"], statuses: ["進行中", "待處理"] }
  };
}

function responseFor(url, method) {
  const path = url.pathname;
  if (path === "/api/dashboard") return dashboardFixture();
  if (path === "/api/calendar-events") return [{ id: "event-1", event_date: "2026-08-13", title: "例行維護", event_type: "工作" }];
  if (path === "/api/work-logs") return { rows: workRows };
  if (path === "/api/follow-ups") return followUps;
  if (path === "/api/recurring-tasks") return recurringTasks;
  if (path === "/api/quick-notes") return [{ id: "note-1", content: "記得確認備份報表與交換器告警。", sort_order: 1, created_at: FIXED_NOW }];
  if (path === "/api/inspections") return { rows: [inspectionRecord] };
  if (path === "/api/inspections/qa-inspection") return { record: inspectionRecord };
  if (path === "/api/password-entries") return [{
    id: "password-1",
    category: "營運系統",
    system_name: "內部工單系統",
    username: "qa.operator",
    login_url: "https://internal.example.com/very/long/application/path",
    bitwarden_item_name: "Hotel IT / QA Work Orders",
    password_item: "Bitwarden 索引",
    notes: "僅存放密碼庫索引資訊"
  }];
  if (path === "/api/reports/preview") return reportFixture();
  if (path === "/api/cost-control") return costControlData;
  if (path === "/api/notifications") return notificationSnapshot;
  if (path === "/api/knowledge") return [knowledgeArticle];
  if (path === "/api/knowledge/qa-article") return knowledgeArticle;
  if (/^\/api\/contracts\/[^/]+\/history$/.test(path)) return { contract: recordData, history: [] };
  if (/^\/api\/assets\/[^/]+\/history$/.test(path)) return { asset: recordData, history: [] };
  if (path === "/api/records") return { rows: [{ id: "record-1", source: url.searchParams.get("source") || "qa", data: recordData }] };
  if (path === "/api/sports/events") return [];
  if (path === "/api/sports/favorites") return [];
  if (path === "/api/sports/standings") return { rows: [], groups: [] };
  if (path === "/api/search") return { results: [] };
  if (path === "/api/line/reminders") return { configured: false, reminders: [] };
  if (path === "/api/ai-assistant") return { message: "QA fixture response" };
  if (method !== "GET") return { success: true, id: "qa-result" };
  return {};
}

export function sessionCookie(baseURL) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(`dashboard-session:${expiresAt}`)
    .digest("base64url");
  const url = new URL(baseURL);
  return {
    name: "taroko_dashboard_session",
    value: `${expiresAt}.${signature}`,
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
    expires: expiresAt
  };
}

export async function prepareContext(context, baseURL) {
  await context.addCookies([sessionCookie(baseURL)]);
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/login" || url.pathname === "/api/logout") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: responseFor(url, request.method()) })
    });
  });
  await context.addInitScript(({ now }) => {
    const NativeDate = Date;
    const fixed = new NativeDate(now).valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }
      static now() {
        return fixed;
      }
    }
    FixedDate.parse = NativeDate.parse;
    FixedDate.UTC = NativeDate.UTC;
    window.Date = FixedDate;
    window.localStorage.setItem("taroko-pwa-install-dismissed", "1");
    window.localStorage.removeItem("dashboard-work-order-v1");
    window.localStorage.removeItem("dashboard-line-repair-events-v1");
  }, { now: FIXED_NOW });
}

export async function waitForStablePage(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.fonts?.status === "loaded");
  await page.waitForTimeout(250);
}

export async function pageMeasurements(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const fixedElements = [];
    const outsideElements = [];
    const undersizedControls = [];
    const all = Array.from(document.body.querySelectorAll("*"));
    for (const element of all) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || style.visibility === "hidden" || style.display === "none") continue;
      if (element.closest(".sidebar:not(.mobile-open), .sidebar-backdrop:not(.show)")) continue;
      if (style.position === "fixed") {
        fixedElements.push({ tag: element.tagName, className: String(element.className || "").slice(0, 100), top: rect.top, bottom: rect.bottom, height: rect.height });
      }
      let candidate = element;
      let intentionallyScrollable = false;
      while (candidate && candidate !== document.body) {
        const candidateStyle = getComputedStyle(candidate);
        if (["auto", "scroll"].includes(candidateStyle.overflowX) && candidate.scrollWidth > candidate.clientWidth + 1) {
          intentionallyScrollable = true;
          break;
        }
        candidate = candidate.parentElement;
      }
      if (!intentionallyScrollable && (rect.left < -1 || rect.right > viewportWidth + 1)) {
        outsideElements.push({ tag: element.tagName, className: String(element.className || "").slice(0, 100), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
      }
      if (element.matches("button, a, input:not([type=hidden]), select, textarea, [role=button]") && rect.width < 36 && rect.height < 36) {
        undersizedControls.push({ tag: element.tagName, className: String(element.className || "").slice(0, 100), text: String(element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 60), width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    }
    const bottomNav = document.querySelector(".mobile-bottom-nav");
    const mainArea = document.querySelector(".main-area");
    const bottomNavRect = bottomNav?.getBoundingClientRect();
    const mainPaddingBottom = mainArea ? parseFloat(getComputedStyle(mainArea).paddingBottom) || 0 : 0;
    return {
      viewportWidth,
      viewportHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      outsideElements: outsideElements.slice(0, 20),
      undersizedControls: undersizedControls.slice(0, 20),
      fixedElements: fixedElements.slice(0, 20),
      bottomNavHeight: bottomNavRect ? Math.round(bottomNavRect.height) : 0,
      mainPaddingBottom: Math.round(mainPaddingBottom)
    };
  });
}
