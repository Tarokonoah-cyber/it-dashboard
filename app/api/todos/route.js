import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import {
  createTodoWithWorkLog,
  isTodoDone,
  normalizeTodo,
  syncTodoToWorkLog,
  validateTextLength
} from "../../../lib/dailyOpsSync";

const MAX_TODO_TITLE_LENGTH = 120;
const MAX_TODO_TEXT_LENGTH = 1000;

function isMissingSortOrderColumn(error) {
  const message = String(error?.message || "");
  return /sort_order/i.test(message) && /(schema cache|could not find|does not exist|PGRST204|PGRST205)/i.test(message);
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    let rows;
    try {
      rows = await supabaseRequest(
        "todo_logs",
        "select=*&order=sort_order.asc.nullslast,created_at.desc&limit=100"
      );
    } catch (error) {
      if (!isMissingSortOrderColumn(error)) throw error;
      rows = await supabaseRequest(
        "todo_logs",
        "select=*&order=created_at.desc&limit=100"
      );
    }
    const todos = rows.map(normalizeTodo).filter((row) => !isTodoDone(row));
    return ok(todos);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { todo, workLog } = await createTodoWithWorkLog(body, "vercel-dashboard");
    return ok({ ...todo, workLogId: workLog?.id || null });
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function PATCH(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return fail(new Error("缺少 Todo ID"), 400);

    const payload = {};
    if (body.title !== undefined) {
      payload.title = validateTextLength(body.title, "Todo title", MAX_TODO_TITLE_LENGTH);
      if (!payload.title) return fail(new Error("Todo title is required"), 400);
    }
    if (body.description !== undefined) {
      payload.description = validateTextLength(body.description, "Todo description", MAX_TODO_TEXT_LENGTH);
    }
    if (body.note !== undefined) payload.note = validateTextLength(body.note, "Todo note", MAX_TODO_TEXT_LENGTH);
    if (body.priority !== undefined) payload.priority = validateTextLength(body.priority, "Todo priority", 40) || "一般";
    if (body.status !== undefined) payload.status = String(body.status || "").trim();
    if (payload.status !== undefined && isTodoDone(payload)) payload.completed_at = new Date().toISOString();
    payload.updated_at = new Date().toISOString();

    const rows = await supabaseRequest("todo_logs", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    const todo = normalizeTodo(rows[0] || { id, ...payload });
    const workLog = await syncTodoToWorkLog(todo);
    return ok({ ...todo, workLogId: workLog?.id || null });
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function DELETE(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

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
