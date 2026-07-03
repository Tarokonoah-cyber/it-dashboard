import { NextResponse } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  getDashboardSessionToken,
  verifyDashboardCredentials
} from "../../../lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const user = String(body.user || "").trim();
  const password = String(body.password || "");

  if (!verifyDashboardCredentials(user, password)) {
    return NextResponse.json(
      { success: false, message: "帳號或密碼錯誤" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, getDashboardSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
  return response;
}
