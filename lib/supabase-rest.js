import "server-only";
import { assertDashboardConfigured } from "./auth";
import { todayTaipei } from "./date";

const ENV_HELP =
  "請在 vercel-dashboard/.env.local 設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY，然後重新啟動 npm run dev。";

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

export async function supabaseRequest(table, query = "select=*", options = {}) {
  assertDashboardConfigured();
  const env = getSupabaseEnv();
  const url = `${env.url}/rest/v1/${table}?${query}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : [];
  if (!response.ok) {
    const message = data && data.message ? data.message : text || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function supabaseRpc(functionName, body) {
  assertDashboardConfigured();
  const env = getSupabaseEnv();
  const url = `${env.url}/rest/v1/rpc/${encodeURIComponent(functionName)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && data.message ? data.message : text || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
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
