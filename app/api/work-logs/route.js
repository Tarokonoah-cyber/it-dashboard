import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

function normalizeWork(row) {
  return {
    ...row,
    title: row.title || row.description || row.subject || row.content || "Untitled work",
    staff: row.staff || row.owner || "",
    category: row.category || row.type || "其他",
    status: row.status || "未開始",
    note: row.note || row.remark || ""
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
    const note = String(body.note || "").trim();

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
        note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    return ok(normalizeWork(rows[0]));
  } catch (error) {
    return fail(error);
  }
}
