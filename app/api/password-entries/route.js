import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

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
