import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { buildPasswordEntryPayload } from "../../../lib/password-entry-mutators";

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const rows = await supabaseRequest(
      "password_entries",
      "select=id,category,system_name,login_url,username,password_item,notes,bitwarden_item_name,bitwarden_item_id,created_at,updated_at&order=category.asc,system_name.asc,id.asc&limit=1000"
    );
    return ok(rows);
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Supabase") ||
      message.includes("Could not find the table") ||
      message.includes("password_entries")
    ) {
      return ok([]);
    }
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const rows = await supabaseRequest("password_entries", "select=*", {
      method: "POST",
      body: buildPasswordEntryPayload(body.data || body)
    });
    return ok(rows[0] || null);
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
    if (!id) return fail(new Error("缺少資料 ID"), 400);
    const rows = await supabaseRequest("password_entries", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      body: buildPasswordEntryPayload(body.data || body)
    });
    if (!rows.length) return fail(new Error("找不到要更新的資料"), 404);
    return ok(rows[0]);
  } catch (error) {
    return fail(error);
  }
}
