import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

function normalizeWork(row) {
  return {
    ...row,
    title: row.title || row.description || row.subject || row.content || "Untitled work",
    staff: row.staff || row.owner || "",
    category: row.category || row.type || "其他",
    status: row.status || "未開始",
    note: row.note || row.remark || row.description || ""
  };
}

function makeWorkId(date) {
  const day = String(date || todayTaipei()).replace(/-/g, "");
  const clock = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(8, 14);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WL-${day}-${clock}-${random}`;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const query = ["select=*&order=date.desc,updated_at.desc,created_at.desc&limit=1000"];
    const date = String(searchParams.get("date") || "").trim();
    const staff = String(searchParams.get("staff") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const category = String(searchParams.get("category") || "").trim();

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
    const date = String(body.date || todayTaipei()).trim();
    const staff = String(body.staff || "").trim();
    const title = String(body.title || "").trim();
    const category = String(body.category || "General").trim();
    const status = String(body.status || "Done").trim();
    const description = String(body.description || body.note || "").trim();

    if (!date) return fail(new Error("Date is required"), 400);
    if (!staff) return fail(new Error("Staff is required"), 400);
    if (!title) return fail(new Error("Title is required"), 400);

    const rows = await supabaseRequest("work_logs", "select=*", {
      method: "POST",
      body: {
        id: makeWorkId(date),
        date,
        staff,
        title,
        category,
        status,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    return ok(normalizeWork(rows[0]));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();
    const allowedKeys = new Set(["id", "status"]);
    const unsupportedKeys = Object.keys(body || {}).filter((key) => !allowedKeys.has(key));

    if (!id) return fail(new Error("Work log id is required"), 400);
    if (unsupportedKeys.length) return fail(new Error("Only id and status can be updated"), 400);
    if (status !== "\u5df2\u5b8c\u6210") return fail(new Error("Only marking a single work item as completed is allowed"), 400);

    const rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: {
        status: "\u5df2\u5b8c\u6210",
        updated_at: new Date().toISOString()
      }
    });

    if (!rows.length) return fail(new Error("Work log not found"), 404);
    return ok(normalizeWork(rows[0]));
  } catch (error) {
    return fail(error);
  }
}
