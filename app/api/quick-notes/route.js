import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";

export async function GET() {
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
  try {
    const body = await request.json();
    const content = String(body.content || "").trim();
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
    return fail(error);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    const content = String(body.content || "").trim();
    if (!id) return fail(new Error("缺少備忘錄 ID"), 400);
    if (!content) return fail(new Error("備忘錄內容不能空白"), 400);

    const rows = await supabaseRequest("quick_notes", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: { content, updated_at: new Date().toISOString() }
    });
    return ok(rows[0] || { id, content });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request) {
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
