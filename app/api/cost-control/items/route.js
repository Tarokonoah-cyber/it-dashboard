import { requireDashboardAuth } from "../../../../lib/auth";
import { normalizeManualBudgetPayload } from "../../../../lib/cost-control-core.js";
import { upsertManualBudgetItem } from "../../../../lib/cost-control-service";
import { fail, ok } from "../../../../lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body) return fail(new Error("預算資料格式不正確"), 400);

  const itemId = body.id ? String(body.id).trim() : null;
  if (itemId && !UUID.test(itemId)) return fail(new Error("預算項目 ID 不正確"), 400);

  let payload;
  try {
    payload = normalizeManualBudgetPayload(body);
  } catch (error) {
    return fail(error, 400);
  }

  try {
    return ok(await upsertManualBudgetItem(itemId, payload));
  } catch (error) {
    const message = String(error?.message || "");
    return fail(error, /已存在|找不到/.test(message) ? 409 : 500);
  }
}
