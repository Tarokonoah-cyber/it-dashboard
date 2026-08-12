import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../../lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true }, {
    headers: { "Cache-Control": "no-store" }
  });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high"
  });
  return response;
}
