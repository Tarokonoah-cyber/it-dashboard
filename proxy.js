import { NextResponse } from "next/server";
import { requireDashboardAuth } from "./lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/cron/sports",
  "/api/cron/operations-reminders",
  "/api/line/webhook",
  "/api/integrations/line-repair",
  "/manifest.webmanifest",
  "/sw.js",
  "/pwa-icon.svg",
  "/pwa-icon-maskable.svg",
  "/offline",
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
  if (authError) {
    if (pathname.startsWith("/api/")) return authError;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
