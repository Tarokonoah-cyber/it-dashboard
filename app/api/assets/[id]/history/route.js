import { requireDashboardAuth } from "../../../../../lib/auth";
import {
  assetProjectionFromSheetRecord,
  isAssetSourceKey,
  normalizeAssetProfile,
  normalizeMaintenanceRecord,
  withWarrantyStatus
} from "../../../../../lib/asset-lifecycle";
import { fail, ok, supabaseRequest, todayTaipei } from "../../../../../lib/supabase-rest";

const ASSET_SELECT = [
  "id",
  "source_record_id",
  "source_key",
  "source_label",
  "record_key",
  "asset_type",
  "asset_name",
  "department",
  "user_name",
  "ip_address",
  "mac_address",
  "model",
  "status",
  "purchase_date",
  "purchase_vendor",
  "purchase_cost",
  "serial_number",
  "warranty_end_date",
  "warranty_note",
  "created_at",
  "updated_at"
].join(",");

const MAINTENANCE_SELECT = "id,asset_id,service_date,event_type,summary,vendor,cost,status,note,created_at,updated_at";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sourceRecordId(context) {
  const params = await context.params;
  return String(params.id || "").trim();
}

async function getSheetRecord(id) {
  if (!isUuid(id)) {
    const error = new Error("設備 ID 格式不正確");
    error.status = 400;
    throw error;
  }
  const rows = await supabaseRequest(
    "sheet_records",
    `id=eq.${encodeURIComponent(id)}&select=id,source_key,source_label,record_key,data,created_at,updated_at&limit=1`
  );
  if (!rows.length || !isAssetSourceKey(rows[0].source_key)) {
    const error = new Error("找不到設備");
    error.status = 404;
    throw error;
  }
  return rows[0];
}

async function ensureAsset(sheetRecord) {
  const rows = await supabaseRequest(
    "assets",
    `on_conflict=source_record_id&select=${ASSET_SELECT}`,
    {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: assetProjectionFromSheetRecord(sheetRecord)
    }
  );
  if (!rows.length) throw new Error("設備主檔同步失敗");
  return rows[0];
}

function statusCode(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
}

export async function GET(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const id = await sourceRecordId(context);
    const sheetRecord = await getSheetRecord(id);
    const asset = await ensureAsset(sheetRecord);
    const maintenance = await supabaseRequest(
      "asset_maintenance_records",
      `asset_id=eq.${encodeURIComponent(asset.id)}&select=${MAINTENANCE_SELECT}&order=service_date.desc,created_at.desc&limit=300`
    );
    return ok({ asset: withWarrantyStatus(asset, todayTaipei()), maintenance });
  } catch (error) {
    return fail(error, statusCode(error));
  }
}

export async function PATCH(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const id = await sourceRecordId(context);
    const body = await request.json();
    const sheetRecord = await getSheetRecord(id);
    const asset = await ensureAsset(sheetRecord);
    const profile = normalizeAssetProfile(body?.profile || body);
    const rows = await supabaseRequest(
      "assets",
      `id=eq.${encodeURIComponent(asset.id)}&select=${ASSET_SELECT}`,
      { method: "PATCH", body: profile }
    );
    if (!rows.length) return fail(new Error("找不到要更新的設備"), 404);
    return ok({ asset: withWarrantyStatus(rows[0], todayTaipei()) });
  } catch (error) {
    return fail(error, statusCode(error));
  }
}

export async function POST(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const id = await sourceRecordId(context);
    const body = await request.json();
    const sheetRecord = await getSheetRecord(id);
    const asset = await ensureAsset(sheetRecord);
    const maintenance = normalizeMaintenanceRecord(body?.maintenance || body);
    const rows = await supabaseRequest(
      "asset_maintenance_records",
      `select=${MAINTENANCE_SELECT}`,
      { method: "POST", body: { ...maintenance, asset_id: asset.id } }
    );
    return ok({ maintenance: rows[0] || null });
  } catch (error) {
    return fail(error, statusCode(error));
  }
}

export async function DELETE(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const id = await sourceRecordId(context);
    const body = await request.json();
    const maintenanceId = String(body?.maintenanceId || "").trim();
    if (!isUuid(maintenanceId)) {
      const error = new Error("維修紀錄 ID 格式不正確");
      error.status = 400;
      throw error;
    }
    const sheetRecord = await getSheetRecord(id);
    const asset = await ensureAsset(sheetRecord);
    const rows = await supabaseRequest(
      "asset_maintenance_records",
      `id=eq.${encodeURIComponent(maintenanceId)}&asset_id=eq.${encodeURIComponent(asset.id)}&select=${MAINTENANCE_SELECT}`,
      { method: "DELETE" }
    );
    if (!rows.length) return fail(new Error("找不到維修紀錄"), 404);
    return ok({ maintenance: rows[0] });
  } catch (error) {
    return fail(error, statusCode(error));
  }
}
