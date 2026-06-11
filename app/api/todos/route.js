import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";

const OPEN_STATUSES = ["未完成", "待處理", "未開始", "處理中"];

export async function GET() {
  try {
    const rows = await supabaseRequest(
      "todo_logs",
      "select=*&order=created_at.desc&limit=100"
    );
    const todos = rows.filter((row) => OPEN_STATUSES.includes(row.status || "未完成"));
    return ok(todos);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    if (!title) return fail(new Error("請輸入待辦內容"), 400);

    const payload = {
      title,
      status: "未完成",
      priority: body.priority || "中",
      owner: body.owner || "Noah",
      due_date: body.due_date || todayTaipei(),
      source: "vercel-dashboard"
    };
    const rows = await supabaseRequest("todo_logs", "select=*", {
      method: "POST",
      body: payload
    });
    return ok(rows[0] || payload);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return fail(new Error("缺少 Todo ID"), 400);

    const payload = {};
    if (body.title !== undefined) payload.title = String(body.title || "").trim();
    if (body.status !== undefined) payload.status = String(body.status || "").trim();
    if (body.status === "已完成") payload.completed_at = new Date().toISOString();
    payload.updated_at = new Date().toISOString();

    const rows = await supabaseRequest("todo_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    return ok(rows[0] || { id, ...payload });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) return fail(new Error("缺少 Todo ID"), 400);
    await supabaseRequest("todo_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "DELETE"
    });
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
