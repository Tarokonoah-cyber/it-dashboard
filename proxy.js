import { NextResponse } from "next/server";
import { requireDashboardAuth } from "./lib/auth";

const PUBLIC_PATHS = [
  "/api/cron/sports",
  "/api/line/webhook",
  "/favicon.ico",
  "/robots.txt"
];

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/cron/sports/")) return true;
  return pathname.startsWith("/_next/");
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
