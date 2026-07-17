import { requireDashboardAuth } from "../../../../lib/auth";
import { executeAssistantActionToken } from "../../../../lib/assistant-actions";

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    if (!token) return Response.json({ success: false, message: "缺少確認內容" }, { status: 400 });
    const result = await executeAssistantActionToken(token);
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ success: false, message: String(error?.message || "動作執行失敗").slice(0, 200) }, { status: 400 });
  }
}
