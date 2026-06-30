import fs from "fs/promises";
import path from "path";
import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

const SOURCE_ALIASES = {
  documents: ["documents"],
  contacts: ["contacts"],
  assets: ["assets_mountain_pc", "assets_downhill_pc", "assets_printer", "assets_north_ya", "assets_iptv"],
  assets_mountain_pc: ["assets_mountain_pc"],
  assets_downhill_pc: ["assets_downhill_pc"],
  assets_printer: ["assets_printer"],
  assets_north_ya: ["assets_north_ya"],
  assets_iptv: ["assets_iptv"],
  contracts: ["contracts", "mobile_contracts"],
  mobile_contracts: ["mobile_contracts"],
  contracts_software: ["contracts"],
  contracts_mobile: ["mobile_contracts"],
  anydesk: ["anydesk"],
  passwords: ["password_entries"],
  sop: ["sop"],
  sop_docs: ["sop"],
  soc_docs: ["sop"]
};

const SOC_SOP_STORAGE_PATH = "soc/soc-mis-checklist-official.xlsx";
const SOC_SOP_TITLE = "SOC MIS 標準作業檢查表";
const SOC_SOP_DESCRIPTION = "SOC 日常標準作業檢查使用";
const SOC_SOP_PUBLIC_URL =
  "https://oidfglrsqrtiimqjfriw.supabase.co/storage/v1/object/public/sop-files/soc/soc-mis-checklist-official.xlsx";

function getPublicStorageUrl(bucket, path) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  if (!supabaseUrl || !path) return "";
  const encodedPath = String(path).split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function getSocSopPublicUrl() {
  return SOC_SOP_PUBLIC_URL;
}

const NORMALIZED_SOURCES = {
  contacts: {
    table: "contacts",
    query: "select=*&order=department.asc,name_zh.asc&limit=1000",
    toData: (row) => ({
      單位: row.department,
      職稱: row.title_zh,
      姓名: row.name_zh,
      "分機 Extension": row.extension,
      "辦公室專線 Office": row.office_phone,
      "中華電信 *55": row.cht_mobile,
      個人行動電話: row.mobile_phone,
      "E-mail address": row.email,
      Position: row.title_en,
      Name: row.name_en,
      備註: row.note
    })
  },
  documents: {
    table: "submitted_documents",
    query: "select=*&order=doc_date.desc,created_at.desc,updated_at.desc,id.desc&limit=1000",
    toData: (row) => ({
      id: row.id,
      record_key: row.record_key,
      日期: row.doc_date,
      月份: row.doc_month,
      部門: row.department || row.cost_center,
      單據格式: row.document_type,
      成本歸屬: row.cost_center,
      供應商: row.vendor,
      項目說明: row.description,
      總金額: row.total_amount,
      備註: row.note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      最後更新時間: row.source_updated_at
    })
  },
  anydesk: {
    table: "anydesk_devices",
    query: "select=id,record_key,device_name,anydesk_id,note,last_checked_at&order=device_name.asc&limit=1000",
    toData: (row) => ({
      設備名稱: row.device_name,
      "AnyDesk ID": row.anydesk_id,
      密碼: "需授權查看",
      備註: row.note,
      最後確認時間: row.last_checked_at
    })
  },
  contracts_software: {
    table: "contracts",
    query: "select=*&order=end_date.asc&limit=1000",
    toData: (row) => ({
      id: row.id,
      contract_name: row.contract_name,
      vendor: row.vendor,
      start_date: row.start_date,
      end_date: row.end_date,
      amount: row.amount,
      owner: row.owner,
      status: row.status,
      note: row.note
    })
  },
  contracts_mobile: {
    table: "mobile_contracts",
    query: "select=*&order=end_date.asc&limit=1000",
    toData: (row) => ({
      id: row.id,
      phone_no: row.phone_no,
      short_code: row.user_name,
      user: row.user_name,
      department: row.department,
      carrier: row.carrier,
      plan: row.plan_name,
      start_date: row.start_date,
      end_date: row.end_date,
      amount: row.amount === null || row.amount === undefined || row.amount === "" ? "" : `NT$${Number(row.amount).toLocaleString("en-US")}`,
      owner: row.owner,
      status: row.status,
      note: row.note
    })
  },
  sop: {
    table: "sop_documents",
    query: "select=*&order=sop_id.asc&limit=1000",
    toData: (row) => ({
      sop_id: row.sop_id,
      sop_name: row.sop_name,
      category: row.category,
      system_name: row.system_name,
      department: row.department,
      version: row.version,
      status: row.status,
      owner: row.owner,
      keywords: row.keywords,
      drive_url: row.drive_url,
      note: row.note
    })
  },
  soc_docs: {
    table: "sop_documents",
    query: `select=id,category,title,version,description,file_path,file_url,updated_at&category=eq.SOC&file_path=eq.${encodeURIComponent(SOC_SOP_STORAGE_PATH)}&order=updated_at.desc&limit=1`,
    toData: (row) => ({
      category: row.category,
      title: SOC_SOP_TITLE,
      version: row.version,
      description: SOC_SOP_DESCRIPTION,
      file_path: SOC_SOP_STORAGE_PATH,
      file_url: getSocSopPublicUrl(),
      updated_at: row.updated_at
    })
  }
};

function assetSourceQuery(source) {
  if (source === "assets") return "select=*&order=source_key.asc,asset_name.asc&limit=1000";
  return `select=*&source_key=eq.${encodeURIComponent(source)}&order=asset_name.asc&limit=1000`;
}

function normalizedConfigFor(source) {
  if (source === "contracts") return NORMALIZED_SOURCES.contracts_software;
  if (source === "mobile_contracts") return NORMALIZED_SOURCES.contracts_mobile;
  if (source === "contracts_mobile") return NORMALIZED_SOURCES.contracts_mobile;
  if (source === "sop_docs") return NORMALIZED_SOURCES.sop;
  if (source === "soc_docs") return NORMALIZED_SOURCES.soc_docs;
  if (source === "assets" || source.startsWith("assets_")) {
    return {
      table: "assets",
      query: assetSourceQuery(source),
      toData: (row) => ({
        資產類型: row.asset_type,
        設備名稱: row.asset_name,
        電腦名稱: row.asset_name,
        部門: row.department,
        使用人: row.user_name,
        IP位置: row.ip_address,
        MAC位置: row.mac_address,
        主機型號: row.model,
        螢幕型號: "",
        設備型號: row.model,
        型號: row.model,
        WINDOWS版本: row.windows_version,
        是否裝防毒: row.antivirus_installed,
        狀態: row.status,
        盤點狀態: row.status,
        盤點人員: row.inventory_staff,
        盤點時間: row.inventory_time,
        備註: row.note,
        盤點備註: row.note,
        最後更新: row.updated_at || row.inventory_time
      })
    };
  }
  return NORMALIZED_SOURCES[source];
}

function wrapNormalizedRows(source, rows, toData) {
  return rows.map((row) => ({
    id: row.id,
    source_key: source,
    source_label: source,
    record_key: row.record_key || row.id || row.sop_id,
    data: toData(row)
  }));
}

async function readLocalContactsRows() {
  try {
    const filePath = path.join(process.cwd(), "data", "contacts.json");
    const text = await fs.readFile(filePath, "utf8");
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function contactsFallbackResponse(source) {
  const rows = await readLocalContactsRows();
  if (!rows.length) return null;
  return ok({ source, normalized: true, rows: wrapNormalizedRows(source, rows, NORMALIZED_SOURCES.contacts.toData) });
}

async function readContactExtensionRows() {
  try {
    const filePath = path.join(process.cwd(), "data", "contacts_extensions.json");
    const text = await fs.readFile(filePath, "utf8");
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function normalizeContactKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function contactValue(row, keys) {
  const data = row?.data || row || {};
  for (const key of keys) {
    const value = data[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function contactLookupKeys(row) {
  const department = normalizeContactKey(contactValue(row, ["單位", "department"]));
  const titleZh = normalizeContactKey(contactValue(row, ["職稱", "title_zh"]));
  const titleEn = normalizeContactKey(contactValue(row, ["Position", "title_en"]));
  const nameZh = normalizeContactKey(contactValue(row, ["姓名", "name_zh"]));
  const nameEn = normalizeContactKey(contactValue(row, ["Name", "name_en"]));
  const email = normalizeContactKey(contactValue(row, ["E-mail address", "email"]));
  return [
    email ? `email:${email}` : "",
    department && nameZh ? `dept-name:${department}:${nameZh}` : "",
    department && nameEn ? `dept-name-en:${department}:${nameEn}` : "",
    department && titleZh ? `dept-title:${department}:${titleZh}` : "",
    department && titleEn ? `dept-title-en:${department}:${titleEn}` : ""
  ].filter(Boolean);
}

async function applyContactExtensionOverlay(rows) {
  const extensionRows = await readContactExtensionRows();
  if (!extensionRows.length) return rows;

  const extensionsByKey = new Map();
  const matchedExtensionIndexes = new Set();
  extensionRows.forEach((row, index) => {
    const extension = contactValue(row, ["分機 Extension", "extension"]);
    if (!extension) return;
    for (const key of contactLookupKeys(row)) {
      if (!extensionsByKey.has(key)) extensionsByKey.set(key, { extension, index });
    }
  });

  const mergedRows = rows.map((row) => {
    const match = contactLookupKeys(row).map((key) => extensionsByKey.get(key)).find(Boolean);
    if (!match) return row;
    matchedExtensionIndexes.add(match.index);
    return {
      ...row,
      data: {
        ...row.data,
        "分機 Extension": match.extension
      }
    };
  });

  const appendedRows = extensionRows
    .filter((row) => contactValue(row, ["分機 Extension", "extension"]))
    .map((row) => ({
      id: `extension-${row.record_key}`,
      source_key: "contacts",
      source_label: "contacts",
      record_key: `extension-${row.record_key}`,
      data: {
        單位: row.department || "",
        職稱: row.title_zh || "",
        姓名: row.name_zh || "",
        "分機 Extension": row.extension || "",
        "中華電信 *55": "",
        個人行動電話: "",
        "E-mail address": row.email || "",
        Position: row.title_en || "",
        Name: row.name_en || "",
        備註: ""
      }
    }));

  return [...mergedRows, ...appendedRows];
}

function sortableDate(value) {
  const raw = String(value || "").trim().slice(0, 10);
  const match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return raw;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function sortableTime(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : 0;
}

function compareSubmittedDocuments(a, b) {
  const dateCompare = sortableDate(b.doc_date).localeCompare(sortableDate(a.doc_date));
  if (dateCompare !== 0) return dateCompare;

  const createdCompare = sortableTime(b.created_at) - sortableTime(a.created_at);
  if (createdCompare !== 0) return createdCompare;

  const updatedCompare = sortableTime(b.updated_at) - sortableTime(a.updated_at);
  if (updatedCompare !== 0) return updatedCompare;

  return String(b.id || "").localeCompare(String(a.id || ""));
}

function dataValue(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

function compareSheetDocuments(a, b) {
  const aData = a.data || {};
  const bData = b.data || {};
  const dateKeys = ["日期", "æ¥æ"];
  const dateCompare = sortableDate(dataValue(bData, dateKeys)).localeCompare(sortableDate(dataValue(aData, dateKeys)));
  if (dateCompare !== 0) return dateCompare;

  const createdCompare = sortableTime(b.created_at) - sortableTime(a.created_at);
  if (createdCompare !== 0) return createdCompare;

  const updatedCompare = sortableTime(b.updated_at) - sortableTime(a.updated_at);
  if (updatedCompare !== 0) return updatedCompare;

  return String(b.id || "").localeCompare(String(a.id || ""));
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const source = String(searchParams.get("source") || "").trim();
    const sources = SOURCE_ALIASES[source];
    if (!sources) return fail(new Error("未知資料來源"), 400);
    if (source === "passwords") {
      let rows = [];
      try {
        rows = await supabaseRequest(
          "password_entries",
          "select=id,category,system_name,login_url,username,password_item,notes,bitwarden_item_name,bitwarden_item_id,created_at,updated_at&order=category.asc,system_name.asc,id.asc&limit=1000"
        );
      } catch (error) {
        if (!String(error.message || "").includes("Could not find the table")) throw error;
      }
      return ok({ source, normalized: true, rows: wrapNormalizedRows(source, rows, (row) => row) });
    }

    const normalized = normalizedConfigFor(source);
    if (normalized) {
      try {
        const rows = await supabaseRequest(normalized.table, normalized.query);
        if (source === "contacts" && rows.length === 0) {
          const fallback = await contactsFallbackResponse(source);
          if (fallback) return fallback;
        }
        if (source === "documents") rows.sort(compareSubmittedDocuments);
        const normalizedRows = wrapNormalizedRows(source, rows, normalized.toData);
        return ok({
          source,
          normalized: true,
          rows: source === "contacts" ? await applyContactExtensionOverlay(normalizedRows) : normalizedRows
        });
      } catch (error) {
        if (source === "contacts") {
          const fallback = await contactsFallbackResponse(source);
          if (fallback) return fallback;
        }
        if (source === "soc_docs") throw error;
        if (!String(error.message || "").includes("Could not find the table")) throw error;
      }
    }

    const sourceFilter = sources.map(encodeURIComponent).join(",");
    const rows = await supabaseRequest(
      "sheet_records",
      `select=*&source_key=in.(${sourceFilter})&order=source_key.asc,record_key.asc&limit=1000`
    );
    if (source === "documents") rows.sort(compareSheetDocuments);

    return ok({ source, rows });
  } catch (error) {
    return fail(error);
  }
}

function documentPayload(body) {
  const docDate = String(body.date || "").trim();
  const docMonth = String(body.month || "").trim() || docDate.slice(0, 7);
  const documentType = String(body.document_type || "").trim();
  const costCenter = String(body.cost_center || "").trim();
  const vendor = String(body.vendor || "").trim();
  const description = String(body.description || "").trim();
  const totalAmount = String(body.total_amount || "").trim();
  const note = String(body.note || "").trim();
  if (!docDate) throw new Error("請選擇日期");
  if (!documentType) throw new Error("請選擇單據格式");
  if (!costCenter) throw new Error("請選擇成本歸屬");
  if (!description) throw new Error("請輸入項目說明");

  return { docDate, docMonth, documentType, costCenter, vendor, description, totalAmount, note };
}

function documentRecordKey(payload) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `DOC-${payload.docDate.replace(/-/g, "")}-${stamp}`;
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const source = String(body.source || "").trim();
    if (source !== "documents") return fail(new Error("目前只支援送交單據紀錄新增"), 400);

    const payload = documentPayload(body);
    const recordKey = documentRecordKey(payload);

    try {
      const rows = await supabaseRequest("submitted_documents", "select=*", {
        method: "POST",
        body: {
          record_key: recordKey,
          doc_date: payload.docDate,
          doc_month: payload.docMonth,
          document_type: payload.documentType,
          cost_center: payload.costCenter,
          vendor: payload.vendor,
          description: payload.description,
          total_amount: payload.totalAmount,
          note: payload.note
        }
      });
      return ok({ normalized: true, row: rows[0] });
    } catch (error) {
      if (!String(error.message || "").includes("Could not find the table")) throw error;
    }

    const rows = await supabaseRequest("sheet_records", "select=*", {
      method: "POST",
      body: {
        source_key: "documents",
        source_label: "送交單據紀錄",
        sheet_name: "送交單據紀錄表",
        record_key: recordKey,
        data: {
          日期: payload.docDate,
          月份: payload.docMonth,
          單據格式: payload.documentType,
          成本歸屬: payload.costCenter,
          供應商: payload.vendor,
          項目說明: payload.description,
          總金額: payload.totalAmount,
          備註: payload.note,
          最後更新時間: new Date().toISOString()
        },
        search_text: [
          recordKey,
          payload.docDate,
          payload.docMonth,
          payload.documentType,
          payload.costCenter,
          payload.vendor,
          payload.description,
          payload.totalAmount,
          payload.note
        ].filter(Boolean).join(" ")
      }
    });
    return ok({ normalized: false, row: rows[0] });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const source = String(body.source || "").trim();
    const id = String(body.id || "").trim();
    if (source !== "documents") return fail(new Error("目前只支援送交單據紀錄更新"), 400);
    if (!id) return fail(new Error("缺少單據 id"), 400);

    const payload = documentPayload(body);
    const rows = await supabaseRequest("submitted_documents", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: {
        doc_date: payload.docDate,
        doc_month: payload.docMonth,
        document_type: payload.documentType,
        cost_center: payload.costCenter,
        vendor: payload.vendor,
        description: payload.description,
        total_amount: payload.totalAmount,
        note: payload.note,
        updated_at: new Date().toISOString()
      }
    });

    if (!rows.length) return fail(new Error("找不到要更新的單據"), 404);
    return ok({ normalized: true, row: rows[0] });
  } catch (error) {
    return fail(error);
  }
}
