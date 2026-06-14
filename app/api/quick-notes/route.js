import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

const MAX_QUICK_NOTE_LENGTH = 2000;

function validateContent(value) {
  const content = String(value || "").trim();
  if (!content) {
    const error = new Error("Quick note content is required");
    error.name = "ValidationError";
    throw error;
  }
  if (content.length > MAX_QUICK_NOTE_LENGTH) {
    const error = new Error(`Quick note content must be ${MAX_QUICK_NOTE_LENGTH} characters or less`);
    error.name = "ValidationError";
    throw error;
  }
  return content;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const rows = await supabaseRequest(
      "quick_notes",
      "select=*&order=sort_order.asc,created_at.desc&limit=200"
    );
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const content = validateContent(body.content);
    if (!content) return fail(new Error("請輸入備忘錄內容"), 400);

    const maxRows = await supabaseRequest(
      "quick_notes",
      "select=sort_order&order=sort_order.desc&limit=1"
    );
    const nextOrder = maxRows[0] ? Number(maxRows[0].sort_order || 0) + 1 : 1;
    const rows = await supabaseRequest("quick_notes", "select=*", {
      method: "POST",
      body: { content, sort_order: nextOrder }
    });
    return ok(rows[0]);
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
    const content = validateContent(body.content);
    if (!id) return fail(new Error("缺少備忘錄 ID"), 400);
    if (!content) return fail(new Error("備忘錄內容不能空白"), 400);

    const rows = await supabaseRequest("quick_notes", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: { content, updated_at: new Date().toISOString() }
    });
    return ok(rows[0] || { id, content });
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
    if (!id) return fail(new Error("缺少備忘錄 ID"), 400);
    await supabaseRequest("quick_notes", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "DELETE"
    });
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
