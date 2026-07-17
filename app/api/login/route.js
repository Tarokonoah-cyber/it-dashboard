import { NextResponse } from "next/server";
import {
  createDashboardSessionToken,
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_TTL_SECONDS,
  dashboardAuthConfigured
} from "../../../lib/auth";
import { verifyDashboardLoginCredentials } from "../../../lib/dashboard-credentials";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const user = String(body.user || "").trim();
  const password = String(body.password || "");

  if (!dashboardAuthConfigured()) {
    return NextResponse.json(
      { success: false, message: "登入服務尚未完成安全設定" },
      { status: 503 }
    );
  }

  try {
    if (!await verifyDashboardLoginCredentials(user, password)) {
      return NextResponse.json(
        { success: false, message: "帳號或密碼錯誤" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("[login credential error]", error);
    return NextResponse.json(
      { success: false, message: "登入服務暫時無法連線，請稍後再試" },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, createDashboardSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DASHBOARD_SESSION_TTL_SECONDS
  });
  return response;
}
