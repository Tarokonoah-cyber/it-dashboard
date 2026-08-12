import "server-only";
import { createHmac } from "node:crypto";

export const DASHBOARD_LOGIN_USER = "taroko";
export const DASHBOARD_SESSION_COOKIE = "taroko_dashboard_session";
export const DASHBOARD_SESSION_TTL_SECONDS = 60 * 60 * 8;

function authEnv() {
  return {
    configuredUser: String(process.env.DASHBOARD_LOGIN_USER || "").trim(),
    password: String(process.env.DASHBOARD_LOGIN_PASSWORD || ""),
    secret: String(process.env.DASHBOARD_SESSION_SECRET || "")
  };
}

export function dashboardAuthConfigured() {
  const env = authEnv();
  const storedCredentialsConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const environmentCredentialsConfigured = Boolean(
    env.password && (!env.configuredUser || env.configuredUser === DASHBOARD_LOGIN_USER)
  );
  return Boolean(
    env.secret.length >= 32 &&
    (storedCredentialsConfigured || environmentCredentialsConfigured)
  );
}

export function dashboardLoginUser() {
  return DASHBOARD_LOGIN_USER;
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

export function verifyDashboardCredentials(user, password) {
  if (!dashboardAuthConfigured()) return false;
  const env = authEnv();
  if (!env.password) return false;
  if (env.configuredUser && env.configuredUser !== DASHBOARD_LOGIN_USER) return false;
  return (
    timingSafeEqualText(user, DASHBOARD_LOGIN_USER) &&
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
  if (!dashboardAuthConfigured()) return dashboardServiceUnavailableResponse();
  const sessionCookie = request.cookies?.get?.(DASHBOARD_SESSION_COOKIE)?.value || "";
  if (verifyDashboardSessionCookie(sessionCookie)) return null;
  return dashboardUnauthorizedResponse();
}
