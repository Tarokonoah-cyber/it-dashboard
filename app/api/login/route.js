import { NextResponse } from "next/server";
import {
  createDashboardSessionToken,
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_TTL_SECONDS,
  dashboardAuthConfigured
} from "../../../lib/auth";
import { verifyDashboardLoginCredentials } from "../../../lib/dashboard-credentials";
import { PayloadTooLargeError, readLimitedText } from "../../../lib/request-body";

const MAX_LOGIN_BODY_BYTES = 16 * 1024;

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request) {
  let body;
  try {
    body = JSON.parse(await readLimitedText(request, MAX_LOGIN_BODY_BYTES) || "{}");
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return json({ success: false, message: "登入資料過大" }, 413);
    }
    return json({ success: false, message: "登入資料格式不正確" }, 400);
  }
  const user = String(body.user || "").trim();
  const password = String(body.password || "");

  if (!dashboardAuthConfigured()) {
    return json({ success: false, message: "登入服務尚未完成安全設定" }, 503);
  }

  try {
    if (!await verifyDashboardLoginCredentials(user, password)) {
      return json({ success: false, message: "帳號或密碼錯誤" }, 401);
    }
    const response = json({ success: true });
    response.cookies.set(DASHBOARD_SESSION_COOKIE, createDashboardSessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DASHBOARD_SESSION_TTL_SECONDS,
      priority: "high"
    });
    return response;
  } catch (error) {
    console.error("[login credential error]", error);
    return json({ success: false, message: "登入服務暫時無法連線，請稍後再試" }, 503);
  }
}
