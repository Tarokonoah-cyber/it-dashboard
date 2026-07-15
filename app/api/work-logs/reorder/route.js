import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../../lib/auth";

const SETUP_MESSAGE = "工作排序欄位尚未建立；目前順序會保存在這台裝置，套用 work_logs sort_order migration 後即可跨裝置同步。";

function isMissingSortOrderColumn(error) {
  const message = String(error?.message || "");
  return /sort_order/i.test(message) && /(schema cache|could not find|does not exist|PGRST204|PGRST205)/i.test(message);
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids)
      ? Array.from(new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))).slice(0, 500)
      : [];
    if (!ids.length) return fail(new Error("請提供要排序的工作"), 400);

    await Promise.all(ids.map((id, index) => (
      supabaseRequest("work_logs", `id=eq.${encodeURIComponent(id)}&select=id`, {
        method: "PATCH",
        body: { sort_order: index + 1, updated_at: new Date().toISOString() }
      })
    )));

    return ok({ ids });
  } catch (error) {
    if (isMissingSortOrderColumn(error)) return fail(new Error(SETUP_MESSAGE), 409);
    return fail(error);
  }
}
