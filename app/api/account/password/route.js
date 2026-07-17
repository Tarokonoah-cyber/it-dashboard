import { NextResponse } from "next/server";
import { dashboardLoginUser, requireDashboardAuth } from "../../../../lib/auth";
import {
  updateDashboardPassword,
  verifyDashboardLoginCredentials
} from "../../../../lib/dashboard-credentials";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const user = dashboardLoginUser();
  const currentPassword = String(body.currentPassword || "");
  const nextPassword = String(body.nextPassword || "");

  if (!currentPassword || !nextPassword) {
    return NextResponse.json(
      { success: false, message: "請完整填寫目前密碼與新密碼" },
      { status: 400 }
    );
  }
  if (nextPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { success: false, message: `新密碼至少需要 ${MIN_PASSWORD_LENGTH} 碼` },
      { status: 400 }
    );
  }
  if (currentPassword === nextPassword) {
    return NextResponse.json(
      { success: false, message: "新密碼不可與目前密碼相同" },
      { status: 400 }
    );
  }

  try {
    const verified = await verifyDashboardLoginCredentials(user, currentPassword);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: "帳號或目前密碼錯誤" },
        { status: 401 }
      );
    }
    await updateDashboardPassword(user, nextPassword);
    return NextResponse.json({ success: true, message: "密碼已更新，下次登入請使用新密碼" });
  } catch (error) {
    console.error("[password update error]", error);
    const missingTable = String(error?.message || "").includes("dashboard_login_credentials");
    return NextResponse.json(
      {
        success: false,
        message: missingTable
          ? "密碼變更功能尚未完成資料庫設定"
          : "密碼暫時無法更新，請稍後再試"
      },
      { status: 503 }
    );
  }
}
