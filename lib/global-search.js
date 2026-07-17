import "server-only";

import { supabaseRequest } from "./supabase-rest";
import { rankSearchResults, safePasswordSearchResult } from "./search-utils";

function value(row, keys, fallback = "") {
  for (const key of keys) {
    const candidate = row?.[key] ?? row?.data?.[key];
    if (candidate !== null && candidate !== undefined && String(candidate).trim()) return String(candidate).trim();
  }
  return fallback;
}

function result({ id, source, category, title, subtitle = "", href, searchText = "" }) {
  return {
    id: String(id || `${source}-${title}`),
    source,
    category,
    title: String(title || "未命名項目"),
    subtitle: String(subtitle || ""),
    href,
    searchText: String(searchText || `${title} ${subtitle}`)
  };
}

const SOURCES = [
  {
    key: "work",
    table: "work_logs",
    query: "select=*&order=date.desc,updated_at.desc&limit=500",
    map: (row) => result({ id: row.id, source: "work", category: "工作紀錄", title: value(row, ["title", "summary", "description"], "未命名工作"), subtitle: [value(row, ["date"]), value(row, ["category", "type"]), value(row, ["status"])].filter(Boolean).join(" · "), href: "/work", searchText: [row.title, row.summary, row.description, row.category, row.type, row.status, row.system, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "todos",
    table: "todo_logs",
    query: "select=*&order=created_at.desc&limit=300",
    map: (row) => result({ id: row.id, source: "todos", category: "待辦事項", title: value(row, ["title", "description"], "未命名待辦"), subtitle: [value(row, ["priority"]), value(row, ["status"])].filter(Boolean).join(" · "), href: "/", searchText: [row.title, row.description, row.note, row.priority, row.status].filter(Boolean).join(" ") })
  },
  {
    key: "follow-ups",
    table: "follow_ups",
    query: "select=*&order=next_follow_date.asc&limit=300",
    map: (row) => result({ id: row.id, source: "follow-ups", category: "待追蹤", title: value(row, ["title"], "未命名追蹤事項"), subtitle: [value(row, ["next_follow_date"]), value(row, ["current_status"])].filter(Boolean).join(" · "), href: "/follow-ups", searchText: [row.title, row.note, row.assignee, row.current_status, row.next_follow_date].filter(Boolean).join(" ") })
  },
  {
    key: "inspection-records",
    table: "inspection_records",
    query: "select=*&order=inspection_date.desc&limit=500",
    map: (row) => result({ id: row.id, source: "inspections", category: "巡檢紀錄", title: `${value(row, ["inspection_date"], "未標日期")} 巡檢`, subtitle: [value(row, ["inspector_name"]), value(row, ["overall_status"])].filter(Boolean).join(" · "), href: `/inspections/${encodeURIComponent(row.id)}`, searchText: [row.inspection_date, row.inspector_name, row.overall_status, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "inspection-items",
    table: "inspection_record_items",
    query: "select=*&order=updated_at.desc&limit=1000",
    map: (row) => result({ id: row.id, source: "inspection-items", category: "巡檢項目", title: value(row, ["item_name"], "未命名巡檢項目"), subtitle: [value(row, ["category"]), value(row, ["status"]), value(row, ["handling_status"])].filter(Boolean).join(" · "), href: `/inspections/${encodeURIComponent(row.inspection_record_id)}`, searchText: [row.item_name, row.category, row.status, row.issue_description, row.handling_status, row.handling_method, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "assets",
    table: "sheet_records",
    query: "select=id,source_key,source_label,record_key,data,search_text&source_key=like.assets_*&order=source_key.asc,record_key.asc&limit=1000",
    map: (row) => {
      const title = value(row, ["設備名稱", "電腦名稱", "asset_name", "名稱"], row.record_key || "未命名設備");
      const sourceKey = row.source_key || "assets";
      const href = sourceKey === "assets_mountain_pc" ? "/assets/mountain-pc" : sourceKey === "assets_downhill_pc" ? "/assets/downhill-pc" : sourceKey === "assets_printer" ? "/assets/printers" : sourceKey === "assets_north_ya" ? "/assets/north-ya" : sourceKey === "assets_iptv" ? "/assets/iptv" : "/assets";
      return result({ id: row.id, source: "assets", category: "設備", title, subtitle: [value(row, ["部門", "department"]), value(row, ["IP", "IP 位址", "IP位址", "ip_address"]), value(row, ["使用人", "使用者", "user_name"])].filter(Boolean).join(" · "), href, searchText: row.search_text || Object.values(row.data || {}).join(" ") });
    }
  },
  {
    key: "contacts",
    table: "contacts",
    query: "select=id,department,title_zh,title_en,name_zh,name_en,extension,office_phone,cht_mobile,mobile_phone,email&order=department.asc,name_zh.asc&limit=1000",
    map: (row) => result({ id: row.id, source: "contacts", category: "通訊錄", title: value(row, ["name_zh", "name_en"], "未命名聯絡人"), subtitle: [row.department, row.title_zh, row.extension ? `分機 ${row.extension}` : ""].filter(Boolean).join(" · "), href: "/contacts", searchText: [row.department, row.title_zh, row.title_en, row.name_zh, row.name_en, row.extension, row.office_phone, row.cht_mobile, row.mobile_phone, row.email].filter(Boolean).join(" ") })
  },
  {
    key: "anydesk",
    table: "anydesk_devices",
    query: "select=id,device_name,anydesk_id,last_checked_at&order=device_name.asc&limit=1000",
    map: (row) => result({ id: row.id, source: "anydesk", category: "AnyDesk", title: value(row, ["device_name"], "未命名設備"), subtitle: row.anydesk_id ? `ID ${row.anydesk_id}` : "", href: "/anydesk", searchText: [row.device_name, row.anydesk_id].filter(Boolean).join(" ") })
  },
  {
    key: "contracts",
    table: "contracts",
    query: "select=id,contract_name,vendor,start_date,end_date,owner,status,note&order=end_date.asc&limit=1000",
    map: (row) => result({ id: row.id, source: "contracts", category: "軟體合約", title: value(row, ["contract_name"], "未命名合約"), subtitle: [row.vendor, row.end_date ? `到期 ${row.end_date}` : "", row.status].filter(Boolean).join(" · "), href: "/contracts/software", searchText: [row.contract_name, row.vendor, row.owner, row.status, row.note, row.start_date, row.end_date].filter(Boolean).join(" ") })
  },
  {
    key: "mobile-contracts",
    table: "mobile_contracts",
    query: "select=id,phone_no,user_name,department,carrier,plan_name,start_date,end_date,owner,status,note&order=end_date.asc&limit=1000",
    map: (row) => result({ id: row.id, source: "mobile-contracts", category: "門號合約", title: value(row, ["phone_no"], "未命名門號"), subtitle: [row.user_name, row.department, row.end_date ? `到期 ${row.end_date}` : ""].filter(Boolean).join(" · "), href: "/contracts/mobile", searchText: [row.phone_no, row.user_name, row.department, row.carrier, row.plan_name, row.owner, row.status, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "sop",
    table: "sop_documents",
    query: "select=*&order=sop_id.asc&limit=1000",
    map: (row) => result({ id: row.id, source: "sop", category: "SOP", title: value(row, ["sop_name", "title"], "未命名文件"), subtitle: [row.sop_id, row.category, row.system_name, row.version].filter(Boolean).join(" · "), href: "/sop/docs", searchText: [row.sop_id, row.sop_name, row.title, row.category, row.system_name, row.department, row.owner, row.keywords, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "knowledge",
    table: "knowledge_articles",
    query: "select=id,title,article_type,category,system_name,symptom,possible_cause,summary,keywords,status&status=neq.archived&order=sort_order.asc,updated_at.desc&limit=500",
    map: (row) => result({ id: row.id, source: "knowledge", category: "故障知識", title: row.title, subtitle: [row.category, row.system_name, row.status === "draft" ? "草稿" : ""].filter(Boolean).join(" · "), href: `/incidents?article=${encodeURIComponent(row.id)}`, searchText: [row.title, row.category, row.system_name, row.symptom, row.possible_cause, row.summary, row.keywords].filter(Boolean).join(" ") })
  },
  {
    key: "documents",
    table: "submitted_documents",
    query: "select=*&order=doc_date.desc,created_at.desc&limit=1000",
    map: (row) => result({ id: row.id, source: "documents", category: "送交單據", title: value(row, ["description", "document_type"], "未命名單據"), subtitle: [row.doc_date, row.vendor, row.cost_center].filter(Boolean).join(" · "), href: "/documents", searchText: [row.doc_date, row.doc_month, row.document_type, row.cost_center, row.vendor, row.description, row.total_amount, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "calendar",
    table: "calendar_events",
    query: "select=*&order=event_date.desc,event_time.asc.nullsfirst&limit=500",
    map: (row) => result({ id: row.id, source: "calendar", category: "行事曆", title: value(row, ["title"], "未命名行程"), subtitle: [row.event_date, row.event_time ? String(row.event_time).slice(0, 5) : "", row.event_type].filter(Boolean).join(" · "), href: "/calendar", searchText: [row.title, row.event_date, row.event_type, row.note].filter(Boolean).join(" ") })
  },
  {
    key: "quick-notes",
    table: "quick_notes",
    query: "select=id,content,created_at,updated_at&order=sort_order.asc,created_at.desc&limit=300",
    map: (row) => result({ id: row.id, source: "quick-notes", category: "快速備忘", title: String(row.content || "未命名備忘").slice(0, 80), subtitle: row.updated_at ? String(row.updated_at).slice(0, 10) : "", href: "/quick-notes", searchText: row.content })
  }
];

const PASSWORD_SOURCE = {
  key: "passwords",
  table: "password_entries",
  query: "select=id,category,system_name,password_item,bitwarden_item_name&order=category.asc,system_name.asc&limit=1000",
  map: safePasswordSearchResult
};

export async function searchDashboard(query, { includePasswords = true, totalLimit, categoryLimit } = {}) {
  const sources = includePasswords ? [...SOURCES, PASSWORD_SOURCE] : SOURCES;
  const settled = await Promise.allSettled(sources.map(async (source) => {
    const rows = await supabaseRequest(source.table, source.query);
    return rows.map(source.map);
  }));
  const results = [];
  const warnings = [];
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") results.push(...entry.value);
    else warnings.push({ source: sources[index].key, message: "此類資料暫時無法搜尋" });
  });
  return {
    results: rankSearchResults(results, query, totalLimit, categoryLimit),
    warnings
  };
}
