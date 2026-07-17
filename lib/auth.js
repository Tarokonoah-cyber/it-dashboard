import "server-only";
import { createHmac } from "node:crypto";

export const DASHBOARD_SESSION_COOKIE = "taroko_dashboard_session";
export const DASHBOARD_SESSION_TTL_SECONDS = 60 * 60 * 8;

function authEnv() {
  return {
    user: String(process.env.DASHBOARD_LOGIN_USER || "").trim(),
    password: String(process.env.DASHBOARD_LOGIN_PASSWORD || ""),
    secret: String(process.env.DASHBOARD_SESSION_SECRET || "")
  };
}

export function dashboardAuthConfigured() {
  const env = authEnv();
  return Boolean(env.user && env.password && env.secret.length >= 32);
}

export function dashboardLoginUser() {
  return authEnv().user;
}

export function assertDashboardConfigured() {
  if (process.env.NODE_ENV !== "production") return;
  if (!dashboardAuthConfigured()) {
    throw new Error("Dashboard auth is not configured");
  }
}

export function dashboardUnauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export function dashboardServiceUnavailableResponse() {
  return new Response("Dashboard auth is not configured", {
    status: 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function timingSafeEqualText(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""));
  const right = Buffer.from(String(rightValue || ""));
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

function parseBasicAuth(headerValue) {
  const auth = String(headerValue || "");
  if (!auth.startsWith("Basic ")) return null;

  const decoded = Buffer.from(auth.slice("Basic ".length), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;

  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1)
  };
}

function isLocalDevelopmentRequest(request) {
  if (process.env.NODE_ENV === "production") return false;
  const host = String(request.headers.get("host") || "").toLowerCase();
  return host.startsWith("127.0.0.1:") || host.startsWith("localhost:");
}

function sessionSignature(expiresAt) {
  const { secret } = authEnv();
  return createHmac("sha256", secret)
    .update(`dashboard-session:${expiresAt}`)
    .digest("base64url");
}

export function createDashboardSessionToken(now = Date.now()) {
  if (!dashboardAuthConfigured()) throw new Error("Dashboard auth is not configured");
  const expiresAt = Math.floor(now / 1000) + DASHBOARD_SESSION_TTL_SECONDS;
  return `${expiresAt}.${sessionSignature(expiresAt)}`;
}

export function verifyDashboardAuthHeader(headerValue) {
  if (!dashboardAuthConfigured()) return { configured: false, authenticated: false };
  try {
    const credentials = parseBasicAuth(headerValue);
    if (!credentials) return { configured: true, authenticated: false };

    const env = authEnv();
    return {
      configured: true,
      authenticated:
        timingSafeEqualText(credentials.user, env.user) &&
        timingSafeEqualText(credentials.password, env.password)
    };
  } catch {
    return { configured: true, authenticated: false };
  }
}

export function verifyDashboardCredentials(user, password) {
  if (!dashboardAuthConfigured()) return false;
  const env = authEnv();
  return (
    timingSafeEqualText(user, env.user) &&
    timingSafeEqualText(password, env.password)
  );
}

export function verifyDashboardSessionCookie(cookieValue, now = Date.now()) {
  if (!dashboardAuthConfigured()) return false;
  const match = String(cookieValue || "").match(/^(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;
  return timingSafeEqualText(match[2], sessionSignature(expiresAt));
}

export function requireDashboardAuth(request) {
  if (isLocalDevelopmentRequest(request)) return null;
  if (!dashboardAuthConfigured()) return dashboardServiceUnavailableResponse();
  const sessionCookie = request.cookies?.get?.(DASHBOARD_SESSION_COOKIE)?.value || "";
  if (verifyDashboardSessionCookie(sessionCookie)) return null;
  const verification = verifyDashboardAuthHeader(request.headers.get("authorization") || "");
  if (!verification.authenticated) return dashboardUnauthorizedResponse();
  return null;
}
