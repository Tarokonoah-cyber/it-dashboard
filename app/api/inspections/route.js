import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { calculateInspectionSummary, createTemplateItems } from "../../../components/inspections/inspectionTemplates";
import { notifyInspectionCriticalTransition } from "../../../lib/lineSmartNotifications";

function normalizeAttachments(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeItem(item) {
  return {
    id: item.id,
    category: String(item.category || "").trim(),
    item_name: String(item.item_name || "").trim(),
    status: String(item.status || "正常").trim(),
    issue_description: String(item.issue_description || "").trim(),
    handling_status: String(item.handling_status || "未處理").trim(),
    handling_method: String(item.handling_method || "").trim(),
    attachments: normalizeAttachments(item.attachments),
    note: String(item.note || "").trim()
  };
}

function validateRecordPayload(body) {
  const inspection_date = String(body.inspection_date || body.date || todayTaipei()).trim();
  const inspector_name = String(body.inspector_name || "").trim();
  const note = String(body.note || "").trim();
  const items = (Array.isArray(body.items) && body.items.length ? body.items : createTemplateItems()).map(normalizeItem);

  if (!inspection_date) throw new Error("請選擇巡檢日期");
  if (!inspector_name) throw new Error("請輸入巡檢人員");
  if (!items.length) throw new Error("巡檢項目不可為空");
  for (const item of items) {
    if (!item.category) throw new Error("巡檢類別不可為空");
    if (!item.item_name) throw new Error("巡檢項目不可為空");
    if (!item.status) throw new Error("巡檢狀態不可為空");
  }

  const summary = calculateInspectionSummary(items);
  return { inspection_date, inspector_name, note, items, summary };
}

async function getItemsForRecord(recordId) {
  return supabaseRequest(
    "inspection_record_items",
    `select=*&inspection_record_id=eq.${encodeURIComponent(recordId)}&order=category.asc,item_name.asc`
  );
}

async function enrichRecords(records) {
  return Promise.all(
    records.map(async (record) => {
      const items = await getItemsForRecord(record.id);
      return {
        ...record,
        items,
        item_count: items.length,
        normal_count: items.filter((item) => item.status === "正常").length
      };
    })
  );
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const query = ["select=*&order=inspection_date.desc,updated_at.desc&limit=500"];
    const date = String(searchParams.get("date") || "").trim();
    const inspectorName = String(searchParams.get("inspector_name") || "").trim();
    const overallStatus = String(searchParams.get("overall_status") || "").trim();

    if (date) query.push(`inspection_date=eq.${encodeURIComponent(date)}`);
    if (inspectorName) query.push(`inspector_name=eq.${encodeURIComponent(inspectorName)}`);
    if (overallStatus) query.push(`overall_status=eq.${encodeURIComponent(overallStatus)}`);

    const rows = await supabaseRequest("inspection_records", query.join("&"));
    const records = await enrichRecords(rows);
    return ok({ rows: records });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const payload = validateRecordPayload(body);
    const existing = await supabaseRequest(
      "inspection_records",
      `select=id,inspection_date&inspection_date=eq.${encodeURIComponent(payload.inspection_date)}&limit=1`
    );

    if (existing.length) {
      return Response.json(
        {
          success: false,
          code: "INSPECTION_DATE_EXISTS",
          message: "這一天已經有每日巡檢紀錄，請改為編輯既有紀錄。",
          data: { id: existing[0].id }
        },
        { status: 409 }
      );
    }

    const recordRows = await supabaseRequest("inspection_records", "select=*", {
      method: "POST",
      body: {
        inspection_date: payload.inspection_date,
        inspector_name: payload.inspector_name,
        overall_status: payload.summary.overall_status,
        abnormal_count: payload.summary.abnormal_count,
        observation_count: payload.summary.observation_count,
        note: payload.note
      }
    });

    const record = recordRows[0];
    if (!record?.id) throw new Error("建立巡檢主表失敗");

    try {
      await supabaseRequest("inspection_record_items", "select=*", {
        method: "POST",
        body: payload.items.map((item) => ({
          inspection_record_id: record.id,
          category: item.category,
          item_name: item.item_name,
          status: item.status,
          issue_description: item.issue_description,
          handling_status: item.handling_status,
          handling_method: item.handling_method,
          attachments: item.attachments,
          note: item.note
        }))
      });
    } catch (itemError) {
      await supabaseRequest("inspection_records", `id=eq.${encodeURIComponent(record.id)}&select=id`, {
        method: "DELETE"
      }).catch((cleanupError) => {
        console.error("[inspection cleanup failed]", cleanupError);
      });
      throw itemError;
    }

    const items = await getItemsForRecord(record.id);
    const createdRecord = { ...record, items, item_count: items.length, normal_count: payload.summary.normal_count };
    await notifyInspectionCriticalTransition(null, createdRecord).catch((lineError) => {
      console.error("[inspection critical LINE push failed]", lineError);
    });
    return ok({ record: createdRecord });
  } catch (error) {
    return fail(error, String(error.message || "").includes("不可") || String(error.message || "").includes("請") ? 400 : 500);
  }
}
