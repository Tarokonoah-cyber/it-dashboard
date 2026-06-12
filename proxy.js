import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/api/line/webhook",
  "/favicon.ico",
  "/robots.txt"
];

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return pathname.startsWith("/_next/");
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Taroko IT Dashboard", charset="UTF-8"',
      "Cache-Control": "no-store"
    }
  });
}

function serviceUnavailable() {
  return new NextResponse("Dashboard auth is not configured", {
    status: 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function timingSafeEqualText(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const expectedUser = process.env.DASHBOARD_AUTH_USER || "taroko";
  const expectedPassword = process.env.DASHBOARD_AUTH_PASSWORD;
  if (!expectedPassword) return serviceUnavailable();

  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(auth.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    const user = separator >= 0 ? decoded.slice(0, separator) : "";
    const password = separator >= 0 ? decoded.slice(separator + 1) : "";

    if (
      timingSafeEqualText(user, expectedUser) &&
      timingSafeEqualText(password, expectedPassword)
    ) {
      return NextResponse.next();
    }
  } catch {
    return unauthorized();
  }

  return unauthorized();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
