export const DASHBOARD_SESSION_COOKIE = "taroko_dashboard_session";
const DASHBOARD_LOGIN_USER = "taroko";
const DASHBOARD_LOGIN_PASSWORD = "123456";
const DASHBOARD_SESSION_TOKEN = "taroko-dashboard-session-v1";

export function dashboardAuthConfigured() {
  return true;
}

export function assertDashboardConfigured() {
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
  const encoder = new TextEncoder();
  const left = encoder.encode(String(leftValue || ""));
  const right = encoder.encode(String(rightValue || ""));
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

export function getDashboardSessionToken() {
  return process.env.DASHBOARD_SESSION_TOKEN || DASHBOARD_SESSION_TOKEN;
}

function parseBasicAuth(headerValue) {
  const auth = String(headerValue || "");
  if (!auth.startsWith("Basic ")) return null;

  const decoded = atob(auth.slice("Basic ".length));
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

export function verifyDashboardAuthHeader(headerValue) {
  try {
    const credentials = parseBasicAuth(headerValue);
    if (!credentials) return { configured: true, authenticated: false };

    return {
      configured: true,
      authenticated:
        timingSafeEqualText(credentials.user, DASHBOARD_LOGIN_USER) &&
        timingSafeEqualText(credentials.password, DASHBOARD_LOGIN_PASSWORD)
    };
  } catch {
    return { configured: true, authenticated: false };
  }
}

export function verifyDashboardCredentials(user, password) {
  return (
    timingSafeEqualText(user, DASHBOARD_LOGIN_USER) &&
    timingSafeEqualText(password, DASHBOARD_LOGIN_PASSWORD)
  );
}

export function verifyDashboardSessionCookie(cookieValue) {
  return timingSafeEqualText(cookieValue, getDashboardSessionToken());
}

export function requireDashboardAuth(request) {
  if (isLocalDevelopmentRequest(request)) return null;
  const sessionCookie = request.cookies?.get?.(DASHBOARD_SESSION_COOKIE)?.value || "";
  if (verifyDashboardSessionCookie(sessionCookie)) return null;
  const verification = verifyDashboardAuthHeader(request.headers.get("authorization") || "");
  if (!verification.configured) return dashboardServiceUnavailableResponse();
  if (!verification.authenticated) return dashboardUnauthorizedResponse();
  return null;
}
