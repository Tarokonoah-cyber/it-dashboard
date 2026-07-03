import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { normalizeTodo, syncTodoToWorkLog } from "../../../lib/dailyOpsSync";
import {
  DEFAULT_FOLLOW_UP_ASSIGNEE,
  buildFollowUpPayload,
  isFollowUpDone,
  normalizeFollowUp,
  sortFollowUps,
  validateFollowUpDate,
  validateFollowUpStatus,
  validateFollowUpText
} from "../../../lib/followUps";

const MAX_FOLLOW_UP_TITLE_LENGTH = 160;
const MAX_FOLLOW_UP_NOTE_LENGTH = 1000;

function currentAssignee() {
  return DEFAULT_FOLLOW_UP_ASSIGNEE;
}

function encodeEq(value) {
  return encodeURIComponent(String(value || "").trim());
}

async function loadTodo(id) {
  if (!id) return null;
  const rows = await supabaseRequest("todo_logs", `id=eq.${encodeEq(id)}&select=*&limit=1`);
  return rows[0] ? normalizeTodo(rows[0]) : null;
}

async function completeSourceTodo(todo) {
  if (!todo?.id) return null;
  const payload = {
    status: "已完成",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRequest("todo_logs", `id=eq.${encodeEq(todo.id)}&select=*`, {
    method: "PATCH",
    body: payload
  });
  const updatedTodo = normalizeTodo(rows[0] || { ...todo, ...payload });
  await syncTodoToWorkLog(updatedTodo);
  return updatedTodo;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get("includeCompleted") === "1";
    const rows = await supabaseRequest(
      "follow_ups",
      "select=*&order=next_follow_date.asc,created_at.desc&limit=200"
    );
    const followUps = sortFollowUps(rows.map(normalizeFollowUp), todayTaipei());
    return ok(includeCompleted ? followUps : followUps.filter((row) => !isFollowUpDone(row)));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    let sourceTodo = null;
    if (body?.source_todo_id) {
      sourceTodo = await loadTodo(body.source_todo_id);
      if (!sourceTodo) return fail(new Error("找不到來源待辦"), 404);
    }

    const payload = {
      ...buildFollowUpPayload(body, {
        title: sourceTodo?.title || "",
        current_status: "等待回覆",
        next_follow_date: todayTaipei(),
        assignee: currentAssignee()
      }),
      created_at: new Date().toISOString()
    };

    const rows = await supabaseRequest("follow_ups", "select=*", {
      method: "POST",
      body: payload
    });
    const followUp = normalizeFollowUp(rows[0] || payload);
    const todo = sourceTodo ? await completeSourceTodo(sourceTodo) : null;
    return ok({ followUp, todo });
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
    if (!id) return fail(new Error("缺少待追蹤 ID"), 400);

    const payload = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) {
      payload.title = validateFollowUpText(body.title, "追蹤事項", MAX_FOLLOW_UP_TITLE_LENGTH);
      if (!payload.title) return fail(new Error("請輸入追蹤事項"), 400);
    }
    if (body.current_status !== undefined) payload.current_status = validateFollowUpStatus(body.current_status);
    if (body.next_follow_date !== undefined) payload.next_follow_date = validateFollowUpDate(body.next_follow_date);
    if (body.note !== undefined) payload.note = validateFollowUpText(body.note, "備註", MAX_FOLLOW_UP_NOTE_LENGTH);
    if (body.assignee !== undefined) payload.assignee = String(body.assignee || "").trim() || currentAssignee();
    if (payload.current_status === "已完成") payload.completed_at = new Date().toISOString();
    if (payload.current_status && payload.current_status !== "已完成") payload.completed_at = null;

    const rows = await supabaseRequest("follow_ups", `id=eq.${encodeEq(id)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    return ok(normalizeFollowUp(rows[0] || { id, ...payload }));
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
    if (!id) return fail(new Error("缺少待追蹤 ID"), 400);
    await supabaseRequest("follow_ups", `id=eq.${encodeEq(id)}&select=*`, {
      method: "DELETE"
    });
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
