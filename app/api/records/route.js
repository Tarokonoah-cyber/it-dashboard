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
  contracts_software: ["contracts"],
  contracts_mobile: ["mobile_contracts"],
  anydesk: ["anydesk"],
  sop: ["sop"]
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = String(searchParams.get("source") || "").trim();
    const sources = SOURCE_ALIASES[source];
    if (!sources) return fail(new Error("未知資料來源"), 400);

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
