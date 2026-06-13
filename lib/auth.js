const DASHBOARD_AUTH_REALM = 'Basic realm="Taroko IT Dashboard", charset="UTF-8"';

export function dashboardAuthConfigured() {
  return Boolean(process.env.DASHBOARD_AUTH_USER && process.env.DASHBOARD_AUTH_PASSWORD);
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
      "WWW-Authenticate": DASHBOARD_AUTH_REALM,
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

export function verifyDashboardAuthHeader(headerValue) {
  const expectedUser = process.env.DASHBOARD_AUTH_USER;
  const expectedPassword = process.env.DASHBOARD_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return { configured: false, authenticated: false };
  }

  try {
    const credentials = parseBasicAuth(headerValue);
    if (!credentials) return { configured: true, authenticated: false };

    return {
      configured: true,
      authenticated:
        timingSafeEqualText(credentials.user, expectedUser) &&
        timingSafeEqualText(credentials.password, expectedPassword)
    };
  } catch {
    return { configured: true, authenticated: false };
  }
}

export function requireDashboardAuth(request) {
  const verification = verifyDashboardAuthHeader(request.headers.get("authorization") || "");
  if (!verification.configured) return dashboardServiceUnavailableResponse();
  if (!verification.authenticated) return dashboardUnauthorizedResponse();
  return null;
}
