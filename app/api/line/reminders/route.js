import { requireDashboardAuth } from "../../../../lib/auth";
import { fail, ok } from "../../../../lib/supabase-rest";
import { getLineReminderStatus, sendLineTestMessage } from "../../../../lib/lineMessaging";

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    return ok(await getLineReminderStatus());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const result = await sendLineTestMessage();
    return ok({ status: result.status, message: "LINE 測試訊息已送出" });
  } catch (error) {
    return fail(error);
  }
}
