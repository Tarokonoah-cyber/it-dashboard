import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

function normalizeTodo(row) {
  return {
    ...row,
    title: row.title || row.description || row.subject || "未命名待辦",
    status: String(row.status || "未完成").trim()
  };
}

export async function GET() {
  try {
    const rows = await supabaseRequest(
      "todo_logs",
      "select=*&order=created_at.desc&limit=100"
    );
    const todos = rows.map(normalizeTodo).filter((row) => !DONE_STATUSES.has(row.status));
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
    return ok(normalizeTodo(rows[0] || payload));
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
    if (DONE_STATUSES.has(payload.status)) payload.completed_at = new Date().toISOString();
    payload.updated_at = new Date().toISOString();

    const rows = await supabaseRequest("todo_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    return ok(normalizeTodo(rows[0] || { id, ...payload }));
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
