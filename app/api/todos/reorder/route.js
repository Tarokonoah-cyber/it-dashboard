import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../../lib/auth";

const SETUP_MESSAGE = "Todo 排序欄位尚未建立，請先在 Supabase SQL Editor 執行 vercel-dashboard/supabase_todo_logs_order.sql。";

function isMissingSortOrderColumn(error) {
  const message = String(error?.message || "");
  return /sort_order/i.test(message) && /(schema cache|could not find|does not exist|PGRST204|PGRST205)/i.test(message);
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.map(String).map((id) => id.trim()).filter(Boolean) : [];
    if (!ids.length) return ok({ updated: 0 });

    await Promise.all(
      ids.map((id, index) =>
        supabaseRequest("todo_logs", `id=eq.${encodeURIComponent(id)}&select=id`, {
          method: "PATCH",
          body: { sort_order: index + 1, updated_at: new Date().toISOString() }
        })
      )
    );

    return ok({ updated: ids.length });
  } catch (error) {
    if (isMissingSortOrderColumn(error)) return fail(new Error(SETUP_MESSAGE), 503);
    return fail(error);
  }
}
