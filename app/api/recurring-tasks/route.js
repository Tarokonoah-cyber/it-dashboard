import { requireDashboardAuth } from "../../../lib/auth";
import { buildRecurringTaskPayload, normalizeRecurringTask } from "../../../lib/recurringTasks";
import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";

const ALLOWED_FIELDS = new Set([
  "id",
  "title",
  "note",
  "priority",
  "owner",
  "recurrence_kind",
  "weekday",
  "day_of_month",
  "start_date",
  "end_date",
  "is_active"
]);

function idOf(value) {
  return String(value || "").trim();
}

function assertAllowedFields(body) {
  const unsupported = Object.keys(body || {}).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unsupported.length) {
    const error = new Error("包含不支援的週期任務欄位");
    error.name = "ValidationError";
    throw error;
  }
}

function isMissingTable(error) {
  return /recurring_task_templates/i.test(String(error?.message || ""))
    && /(schema cache|could not find|does not exist|PGRST205)/i.test(String(error?.message || ""));
}

async function loadTemplate(id) {
  const rows = await supabaseRequest(
    "recurring_task_templates",
    `select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ? normalizeRecurringTask(rows[0]) : null;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "1";
    const archiveFilter = includeArchived ? "" : "&archived_at=is.null";
    const rows = await supabaseRequest(
      "recurring_task_templates",
      `select=*&order=is_active.desc,created_at.desc${archiveFilter}&limit=500`
    );
    return ok(rows.map(normalizeRecurringTask));
  } catch (error) {
    if (isMissingTable(error)) return fail(new Error("週期任務資料表尚未建立"), 503);
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    assertAllowedFields(body);
    const now = new Date().toISOString();
    const payload = buildRecurringTaskPayload(body, { today: todayTaipei() });
    const rows = await supabaseRequest("recurring_task_templates", "select=*", {
      method: "POST",
      body: { ...payload, created_at: now, updated_at: now }
    });
    return ok(normalizeRecurringTask(rows[0] || payload));
  } catch (error) {
    if (isMissingTable(error)) return fail(new Error("週期任務資料表尚未建立"), 503);
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function PATCH(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    assertAllowedFields(body);
    const id = idOf(body.id);
    if (!id) return fail(new Error("缺少週期任務 ID"), 400);
    const current = await loadTemplate(id);
    if (!current || current.archived_at) return fail(new Error("找不到週期任務"), 404);
    const payload = buildRecurringTaskPayload(body, { current, today: todayTaipei() });
    const pauseCheckpoint = current.is_active !== false && payload.is_active === false
      ? { last_checked_date: todayTaipei() }
      : {};
    const rows = await supabaseRequest("recurring_task_templates", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: { ...payload, ...pauseCheckpoint, updated_at: new Date().toISOString() }
    });
    if (!rows.length) return fail(new Error("找不到週期任務"), 404);
    return ok(normalizeRecurringTask(rows[0]));
  } catch (error) {
    if (isMissingTable(error)) return fail(new Error("週期任務資料表尚未建立"), 503);
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function DELETE(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const id = idOf(searchParams.get("id"));
    if (!id) return fail(new Error("缺少週期任務 ID"), 400);
    const now = new Date().toISOString();
    const rows = await supabaseRequest("recurring_task_templates", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: { is_active: false, archived_at: now, updated_at: now }
    });
    if (!rows.length) return fail(new Error("找不到週期任務"), 404);
    return ok({ id, archived: true });
  } catch (error) {
    if (isMissingTable(error)) return fail(new Error("週期任務資料表尚未建立"), 503);
    return fail(error);
  }
}
