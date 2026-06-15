import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../../lib/auth";
import { calculateInspectionSummary } from "../../../../components/inspections/inspectionTemplates";

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

function validateItems(items) {
  if (!items.length) throw new Error("巡檢項目不可為空");
  for (const item of items) {
    if (!item.category) throw new Error("巡檢類別不可為空");
    if (!item.item_name) throw new Error("巡檢項目不可為空");
    if (!item.status) throw new Error("巡檢狀態不可為空");
  }
}

async function getRecord(id) {
  const rows = await supabaseRequest("inspection_records", `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows.length) return null;
  const items = await supabaseRequest(
    "inspection_record_items",
    `select=*&inspection_record_id=eq.${encodeURIComponent(id)}&order=category.asc,item_name.asc`
  );
  const normal_count = items.filter((item) => item.status === "正常").length;
  return { ...rows[0], items, item_count: items.length, normal_count };
}

export async function GET(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const record = await getRecord(id);
    if (!record) return fail(new Error("找不到巡檢紀錄"), 404);
    return ok({ record });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const inspection_date = String(body.inspection_date || "").trim();
    const inspector_name = String(body.inspector_name || "").trim();
    const note = String(body.note || "").trim();
    const items = (Array.isArray(body.items) ? body.items : []).map(normalizeItem);

    if (!inspection_date) return fail(new Error("請選擇巡檢日期"), 400);
    if (!inspector_name) return fail(new Error("請輸入巡檢人員"), 400);
    try {
      validateItems(items);
    } catch (validationError) {
      return fail(validationError, 400);
    }

    const duplicateRows = await supabaseRequest(
      "inspection_records",
      `select=id&inspection_date=eq.${encodeURIComponent(inspection_date)}&id=neq.${encodeURIComponent(id)}&limit=1`
    );
    if (duplicateRows.length) {
      return Response.json(
        {
          success: false,
          code: "INSPECTION_DATE_EXISTS",
          message: "這一天已經有每日巡檢紀錄，請改為編輯既有紀錄。",
          data: { id: duplicateRows[0].id }
        },
        { status: 409 }
      );
    }

    const summary = calculateInspectionSummary(items);
    const updatedRows = await supabaseRequest("inspection_records", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: {
        inspection_date,
        inspector_name,
        overall_status: summary.overall_status,
        abnormal_count: summary.abnormal_count,
        observation_count: summary.observation_count,
        note
      }
    });
    if (!updatedRows.length) return fail(new Error("找不到巡檢紀錄"), 404);

    const existingItems = await supabaseRequest(
      "inspection_record_items",
      `select=id&inspection_record_id=eq.${encodeURIComponent(id)}`
    );
    const existingItemIds = new Set(existingItems.map((item) => item.id));
    const incomingIds = new Set(items.map((item) => item.id).filter(Boolean));
    const invalidItem = items.find((item) => item.id && !existingItemIds.has(item.id));
    if (invalidItem) return fail(new Error("巡檢明細不屬於目前紀錄"), 400);

    await Promise.all(
      existingItems
        .filter((item) => !incomingIds.has(item.id))
        .map((item) =>
          supabaseRequest("inspection_record_items", `id=eq.${encodeURIComponent(item.id)}&select=id`, {
            method: "DELETE"
          })
        )
    );

    for (const item of items) {
      const bodyPayload = {
        inspection_record_id: id,
        category: item.category,
        item_name: item.item_name,
        status: item.status,
        issue_description: item.issue_description,
        handling_status: item.handling_status,
        handling_method: item.handling_method,
        attachments: item.attachments,
        note: item.note
      };
      if (item.id) {
        await supabaseRequest("inspection_record_items", `id=eq.${encodeURIComponent(item.id)}&select=*`, {
          method: "PATCH",
          body: bodyPayload
        });
      } else {
        await supabaseRequest("inspection_record_items", "select=*", {
          method: "POST",
          body: bodyPayload
        });
      }
    }

    const record = await getRecord(id);
    return ok({ record });
  } catch (error) {
    return fail(error);
  }
}
