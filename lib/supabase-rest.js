import "server-only";
import { assertDashboardConfigured } from "./auth";
import { todayTaipei } from "./date";

const ENV_HELP =
  "請在 vercel-dashboard/.env.local 設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY，然後重新啟動 npm run dev。";
const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;
const POSTGREST_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];

  if (!url) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    throw new Error(`缺少 Supabase 環境變數：${missing.join(", ")}。${ENV_HELP}`);
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey
  };
}

export function assertSupabaseEnv() {
  assertDashboardConfigured();
  getSupabaseEnv();
}

function assertPostgrestIdentifier(value, label) {
  const identifier = String(value || "");
  if (!POSTGREST_IDENTIFIER.test(identifier)) {
    throw new Error(`Invalid Supabase ${label}`);
  }
  return identifier;
}

async function parseSupabaseResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(response.ok
        ? "Supabase returned an invalid response"
        : `Supabase request failed (HTTP ${response.status})`);
    }
  }
  if (!response.ok) {
    const message = typeof data?.message === "string" && data.message.trim()
      ? data.message
      : `Supabase request failed (HTTP ${response.status})`;
    const error = new Error(message);
    if (data?.code) error.code = String(data.code);
    throw error;
  }
  return data;
}

async function fetchSupabaseJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Supabase request timed out");
    throw new Error("Supabase request failed");
  } finally {
    clearTimeout(timeout);
  }
  return parseSupabaseResponse(response);
}

export async function supabaseRequest(table, query = "select=*", options = {}) {
  assertDashboardConfigured();
  const env = getSupabaseEnv();
  const safeTable = assertPostgrestIdentifier(table, "table name");
  const url = `${env.url}/rest/v1/${safeTable}?${query}`;
  return fetchSupabaseJson(url, {
    method: options.method || "GET",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });
}

export async function supabaseRpc(functionName, body) {
  assertDashboardConfigured();
  const env = getSupabaseEnv();
  const safeFunctionName = assertPostgrestIdentifier(functionName, "function name");
  const url = `${env.url}/rest/v1/rpc/${safeFunctionName}`;
  return fetchSupabaseJson(url, {
    method: "POST",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
}

export function ok(data) {
  return Response.json({ success: true, data });
}

function sanitizeErrorMessage(error) {
  const raw = error && error.message ? error.message : String(error || "Unknown error");
  return raw
    .replace(/eyJ[\w.-]+/g, "[redacted]")
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer [redacted]")
    .replace(/apikey\s*[:=]\s*[\w.-]+/gi, "apikey=[redacted]")
    .replace(/\b[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|SERVICE_ROLE)[A-Z0-9_]*\b/g, "[redacted setting]")
    .slice(0, 300);
}

export function fail(error, status = 500) {
  console.error("[api error]", error);
  return Response.json({ success: false, message: sanitizeErrorMessage(error) }, { status });
}

export { todayTaipei };
