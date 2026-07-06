import { supabaseRequest, todayTaipei } from "./supabase-rest";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const MAX_TODO_TITLE_LENGTH = 120;
const MAX_TODO_TEXT_LENGTH = 1000;
const DEFAULT_SHARED_OWNER = "共同";

function trimText(value) {
  return String(value || "").trim();
}

export function validateTextLength(value, label, maxLength) {
  const text = trimText(value);
  if (text.length > maxLength) {
    const error = new Error(`${label} must be ${maxLength} characters or less`);
    error.name = "ValidationError";
    throw error;
  }
  return text;
}

export function normalizeTodo(row) {
  return {
    ...row,
    title: row?.title || row?.description || row?.subject || "未命名待辦",
    status: trimText(row?.status || "未完成")
  };
}

export function normalizeWork(row) {
  return {
    ...row,
    title: row?.title || row?.description || row?.subject || row?.content || "未命名工作",
    staff: row?.staff || row?.owner || "",
    category: row?.category || row?.type || "工作",
    status: row?.status || "未完成",
    note: row?.note || row?.remark || ""
  };
}

export function isTodoDone(row) {
  return DONE_STATUSES.has(trimText(row?.status));
}

function mapTodoStatusToWorkStatus(status) {
  const text = trimText(status);
  if (DONE_STATUSES.has(text)) return "已完成";
  if (text === "進行中" || text.toLowerCase() === "doing") return "進行中";
  if (text === "取消" || text.toLowerCase() === "cancelled") return "取消";
  return "未完成";
}

function buildTodoWorkPayload(todo) {
  const row = normalizeTodo(todo || {});
  const todoId = trimText(row.id);
  const title = trimText(row.title);
  if (!todoId) throw new Error("Todo 缺少 id，無法同步到工作中心");
  if (!title) throw new Error("Todo 缺少標題，無法同步到工作中心");

  const dueDate = trimText(row.due_date);
  const note = validateTextLength(row.note, "Todo note", MAX_TODO_TEXT_LENGTH);
  const status = mapTodoStatusToWorkStatus(row.status);

  return {
    date: status === "已完成" ? todayTaipei() : dueDate || todayTaipei(),
    staff: trimText(row.owner) || DEFAULT_SHARED_OWNER,
    title,
    category: "待辦",
    status,
    impact: trimText(row.priority) || "一般",
    description: [
      `Todo ${todoId}: ${title}`,
      dueDate ? `期限 ${dueDate}` : "",
      row.source ? `來源 ${row.source}` : ""
    ].filter(Boolean).join(" / "),
    note,
    source: "todo_logs",
    source_id: todoId,
    updated_at: new Date().toISOString()
  };
}

async function findSyncedWorkLog(sourceId) {
  const rows = await supabaseRequest(
    "work_logs",
    `select=id&source=eq.todo_logs&source_id=eq.${encodeURIComponent(sourceId)}&limit=1`
  );
  return rows[0] || null;
}

export async function syncTodoToWorkLog(todo) {
  const payload = buildTodoWorkPayload(todo);
  const existing = await findSyncedWorkLog(payload.source_id);

  if (existing?.id) {
    const rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(existing.id)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    return normalizeWork(rows[0] || { id: existing.id, ...payload });
  }

  try {
    const rows = await supabaseRequest("work_logs", "select=*", {
      method: "POST",
      body: {
        ...payload,
        created_at: new Date().toISOString()
      }
    });
    return normalizeWork(rows[0] || payload);
  } catch (error) {
    if (!String(error?.message || "").includes("work_logs_source_source_id_uidx")) throw error;
    const duplicate = await findSyncedWorkLog(payload.source_id);
    if (!duplicate?.id) throw error;
    const rows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(duplicate.id)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    return normalizeWork(rows[0] || { id: duplicate.id, ...payload });
  }
}

export async function createTodoWithWorkLog(body, source = "vercel-dashboard") {
  const title = validateTextLength(body?.title, "Todo title", MAX_TODO_TITLE_LENGTH);
  if (body?.description !== undefined) validateTextLength(body.description, "Todo description", MAX_TODO_TEXT_LENGTH);
  const note = body?.note !== undefined ? validateTextLength(body.note, "Todo note", MAX_TODO_TEXT_LENGTH) : "";
  if (!title) {
    const error = new Error("請輸入 Todo 標題");
    error.name = "ValidationError";
    throw error;
  }

  const payload = {
    title,
    status: trimText(body?.status) || "未完成",
    priority: trimText(body?.priority) || "一般",
    owner: trimText(body?.owner) || DEFAULT_SHARED_OWNER,
    due_date: body?.due_date || todayTaipei(),
    source,
    note
  };

  const todoRows = await supabaseRequest("todo_logs", "select=*", {
    method: "POST",
    body: payload
  });
  const todo = normalizeTodo(todoRows[0] || payload);

  try {
    const workLog = await syncTodoToWorkLog(todo);
    return { todo, workLog };
  } catch (error) {
    if (todo.id) {
      try {
        await supabaseRequest("todo_logs", `id=eq.${encodeURIComponent(todo.id)}&select=id`, {
          method: "DELETE"
        });
      } catch (rollbackError) {
        console.error("[todo rollback failed]", rollbackError);
      }
    }
    throw new Error(`Todo 建立失敗：同步工作中心失敗，已停止新增。${error.message || error}`);
  }
}

