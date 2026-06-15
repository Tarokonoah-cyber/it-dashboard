import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { normalizeWork } from "../../../lib/dailyOpsSync";

const MAX_WORK_TEXT_LENGTH = 1000;

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

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const query = ["select=*&order=date.desc,updated_at.desc,created_at.desc&limit=1000"];
    const date = cleanText(searchParams.get("date"));
    const staff = cleanText(searchParams.get("staff"));
    const status = cleanText(searchParams.get("status"));
    const category = cleanText(searchParams.get("category"));

    if (date) query.push(`date=eq.${encodeURIComponent(date)}`);
    if (staff) query.push(`staff=eq.${encodeURIComponent(staff)}`);
    if (status) query.push(`status=eq.${encodeURIComponent(status)}`);
    if (category) query.push(`category=eq.${encodeURIComponent(category)}`);

    const rows = await supabaseRequest("work_logs", query.join("&"));
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
    const staff = validateText(body.staff, "Staff", 120);
    const title = validateText(body.title, "Title", 200);
    const category = validateText(body.category || "工作", "Category", 120);
    const status = validateText(body.status || "未完成", "Status", 120);
    const description = validateText(body.description || "", "Description");
    const note = validateText(body.note || "", "Note");

    if (!date) return fail(new Error("Date is required"), 400);
    if (!staff) return fail(new Error("Staff is required"), 400);
    if (!title) return fail(new Error("Title is required"), 400);

    const rows = await supabaseRequest("work_logs", "select=*", {
      method: "POST",
      body: {
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
      }
    });

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
    const status = cleanText(body.status);
    const allowedKeys = new Set(["id", "status"]);
    const unsupportedKeys = Object.keys(body || {}).filter((key) => !allowedKeys.has(key));

    if (!id) return fail(new Error("Work log id is required"), 400);
    if (unsupportedKeys.length) return fail(new Error("Only id and status can be updated"), 400);
    if (status !== "已完成") return fail(new Error("Only marking a single work item as completed is allowed"), 400);

    const rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: {
        status: "已完成",
        updated_at: new Date().toISOString()
      }
    });

    if (!rows.length) return fail(new Error("Work log not found"), 404);
    return ok(normalizeWork(rows[0]));
  } catch (error) {
    return fail(error);
  }
}
