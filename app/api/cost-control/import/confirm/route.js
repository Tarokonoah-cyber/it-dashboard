import { requireCostControlImportAuth } from "../../../../../lib/cost-control-permissions";
import { confirmCostControlPreview } from "../../../../../lib/cost-control-service";
import { fail, ok } from "../../../../../lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const authError = requireCostControlImportAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json().catch(() => ({}));
    const previewId = String(body.previewId || "").trim();
    const mode = String(body.mode || "new").trim();
    if (!UUID.test(previewId)) return fail(new Error("匯入預覽 ID 不正確"), 400);
    if (!new Set(["new", "overwrite", "version"]).has(mode)) return fail(new Error("匯入模式不正確"), 400);
    return ok(await confirmCostControlPreview(previewId, mode));
  } catch (error) {
    const message = String(error?.message || "");
    return fail(error, /已存在|模式|預覽|無法辨識/.test(message) ? 409 : 500);
  }
}
