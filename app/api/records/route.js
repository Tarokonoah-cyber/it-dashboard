import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";

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
  sop: ["sop"],
  sop_docs: ["sop"],
  soc_docs: ["sop"]
};

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
    query: "select=*&order=doc_date.desc,updated_at.desc&limit=1000",
    toData: (row) => ({
      日期: row.doc_date,
      月份: row.doc_month,
      單據格式: row.document_type,
      成本歸屬: row.cost_center,
      供應商: row.vendor,
      項目說明: row.description,
      總金額: row.total_amount,
      備註: row.note,
      最後更新時間: row.source_updated_at
    })
  },
  anydesk: {
    table: "anydesk_devices",
    query: "select=*&order=device_name.asc&limit=1000",
    toData: (row) => ({
      設備名稱: row.device_name,
      "AnyDesk ID": row.anydesk_id,
      密碼: row.anydesk_password,
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
      user: row.user_name,
      department: row.department,
      carrier: row.carrier,
      plan: row.plan_name,
      end_date: row.end_date,
      amount: row.amount,
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
  }
};

function assetSourceQuery(source) {
  if (source === "assets") return "select=*&order=source_key.asc,asset_name.asc&limit=1000";
  return `select=*&source_key=eq.${encodeURIComponent(source)}&order=asset_name.asc&limit=1000`;
}

function normalizedConfigFor(source) {
  if (source === "contracts") return NORMALIZED_SOURCES.contracts_software;
  if (source === "mobile_contracts") return NORMALIZED_SOURCES.contracts_mobile;
  if (source === "sop_docs" || source === "soc_docs") return NORMALIZED_SOURCES.sop;
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
        設備型號: row.model,
        型號: row.model,
        WINDOWS版本: row.windows_version,
        是否裝防毒: row.antivirus_installed,
        狀態: row.status,
        盤點狀態: row.status,
        盤點人員: row.inventory_staff,
        盤點時間: row.inventory_time,
        備註: row.note,
        盤點備註: row.note
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = String(searchParams.get("source") || "").trim();
    const sources = SOURCE_ALIASES[source];
    if (!sources) return fail(new Error("未知資料來源"), 400);

    const normalized = normalizedConfigFor(source);
    if (normalized) {
      try {
        const rows = await supabaseRequest(normalized.table, normalized.query);
        return ok({ source, normalized: true, rows: wrapNormalizedRows(source, rows, normalized.toData) });
      } catch (error) {
        if (!String(error.message || "").includes("Could not find the table")) throw error;
      }
    }

    const sourceFilter = sources.map(encodeURIComponent).join(",");
    const rows = await supabaseRequest(
      "sheet_records",
      `select=*&source_key=in.(${sourceFilter})&order=source_key.asc,record_key.asc&limit=1000`
    );

    return ok({ source, rows });
  } catch (error) {
    return fail(error);
  }
}
