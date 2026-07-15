import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { normalizeWork } from "../../../lib/dailyOpsSync";

const MAX_WORK_TEXT_LENGTH = 1000;
const MAX_WORK_TITLE_LENGTH = 200;
const DEFAULT_WORK_STAFF = "共同";
const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

function cleanText(value) {
  return String(value || "").trim();
}

function validateText(value, label, maxLength = MAX_WORK_TEXT_LENGTH) {
  const text = cleanText(value);
  if (text.length > maxLength) {
    const error = new Error(`${label} must be ${maxLength} characters or less`);
    error.name = "ValidationError";
    throw error;
  }
  return text;
}

function validateWorkTitle(value) {
  const title = validateText(value, "Title", MAX_WORK_TITLE_LENGTH);
  if (!title) {
    const error = new Error("工作內容不可空白");
    error.name = "ValidationError";
    throw error;
  }
  if (/^\d+$/.test(title)) {
    const error = new Error("工作內容不可只輸入數字");
    error.name = "ValidationError";
    throw error;
  }
  return title;
}

function isMissingSortOrderColumn(error) {
  const message = String(error?.message || "");
  return /sort_order/i.test(message) && /(schema cache|could not find|does not exist|PGRST204|PGRST205)/i.test(message);
}

function isDoneStatus(status) {
  return DONE_STATUSES.has(cleanText(status));
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const filters = [];
    const date = cleanText(searchParams.get("date"));
    const status = cleanText(searchParams.get("status"));
    const category = cleanText(searchParams.get("category"));
    const source = cleanText(searchParams.get("source"));
    const sourceIds = cleanText(searchParams.get("sourceIds"))
      .split(",")
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 100);

    if (date) filters.push(`date=eq.${encodeURIComponent(date)}`);
    if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
    if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
    if (source) filters.push(`source=eq.${encodeURIComponent(source)}`);
    if (sourceIds.length) filters.push(`source_id=in.(${sourceIds.map(encodeURIComponent).join(",")})`);

    let rows;
    try {
      rows = await supabaseRequest(
        "work_logs",
        ["select=*&order=sort_order.asc.nullslast,date.desc,updated_at.desc,created_at.desc&limit=1000", ...filters].join("&")
      );
    } catch (error) {
      if (!isMissingSortOrderColumn(error)) throw error;
      rows = await supabaseRequest(
        "work_logs",
        ["select=*&order=date.desc,updated_at.desc,created_at.desc&limit=1000", ...filters].join("&")
      );
    }
    return ok({ rows: rows.map(normalizeWork) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const date = cleanText(body.date || todayTaipei());
    const staff = validateText(body.staff || DEFAULT_WORK_STAFF, "Staff", 120);
    const title = validateWorkTitle(body.title);
    const category = validateText(body.category || "工作", "Category", 120);
    const status = validateText(body.status || "未完成", "Status", 120);
    const description = validateText(body.description || "", "Description");
    const note = validateText(body.note || "", "Note");

    if (!date) return fail(new Error("Date is required"), 400);
    const payload = {
      date,
      staff,
      title,
      category,
      status,
      description,
      note,
      source: cleanText(body.source) || "vercel-dashboard",
      source_id: cleanText(body.source_id) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    let rows;
    try {
      rows = await supabaseRequest("work_logs", "select=*", {
        method: "POST",
        body: { ...payload, sort_order: isDoneStatus(status) ? null : 0 }
      });
    } catch (error) {
      if (!isMissingSortOrderColumn(error)) throw error;
      rows = await supabaseRequest("work_logs", "select=*", { method: "POST", body: payload });
    }

    return ok(normalizeWork(rows[0]));
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function PATCH(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = cleanText(body.id);
    const allowedKeys = new Set(["id", "date", "staff", "title", "category", "status", "impact", "note", "description"]);
    const unsupportedKeys = Object.keys(body || {}).filter((key) => !allowedKeys.has(key));

    if (!id) return fail(new Error("Work log id is required"), 400);
    if (unsupportedKeys.length) return fail(new Error("Unsupported work log fields"), 400);

    const payload = {};
    if (body.date !== undefined) {
      const date = cleanText(body.date);
      if (!date) return fail(new Error("Date is required"), 400);
      payload.date = date;
    }
    if (body.staff !== undefined) {
      const staff = validateText(body.staff, "Staff", 120);
      payload.staff = staff || DEFAULT_WORK_STAFF;
    }
    if (body.title !== undefined) payload.title = validateWorkTitle(body.title);
    if (body.category !== undefined) payload.category = validateText(body.category || "工作", "Category", 120);
    if (body.status !== undefined) payload.status = validateText(body.status || "未完成", "Status", 120);
    if (body.impact !== undefined) payload.impact = validateText(body.impact || "", "Impact", 120);
    if (body.note !== undefined) payload.note = validateText(body.note || "", "Note");
    if (body.description !== undefined) payload.description = validateText(body.description || "", "Description");

    if (!Object.keys(payload).length) return fail(new Error("No work log fields to update"), 400);

    const mutation = { ...payload, updated_at: new Date().toISOString() };
    if (payload.status !== undefined) mutation.sort_order = isDoneStatus(payload.status) ? null : 0;
    let rows;
    try {
      rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
        method: "PATCH",
        body: mutation
      });
    } catch (error) {
      if (!isMissingSortOrderColumn(error) || mutation.sort_order === undefined) throw error;
      delete mutation.sort_order;
      rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
        method: "PATCH",
        body: mutation
      });
    }

    if (!rows.length) return fail(new Error("Work log not found"), 404);
    return ok(normalizeWork(rows[0]));
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function DELETE(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = cleanText(searchParams.get("id"));
    if (!id) return fail(new Error("Work log id is required"), 400);

    const rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(id)}&select=id`, {
      method: "DELETE"
    });

    if (!rows.length) return fail(new Error("Work log not found"), 404);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
