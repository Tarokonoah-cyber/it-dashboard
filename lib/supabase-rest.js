import { assertDashboardConfigured } from "./auth";

const ENV_HELP =
  "請在 vercel-dashboard/.env.local 設定 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY，然後重新啟動 npm run dev。";

function getSupabaseEnv() {
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

export function ok(data) {
  return Response.json({ success: true, data });
}

export function fail(error, status = 500) {
  console.error("[api error]", error);

  const isDev = process.env.NODE_ENV !== "production";
  const raw = error && error.message ? error.message : String(error || "Unknown error");
  const message = isDev
    ? raw
    : "系統暫時無法處理，請稍後再試或通知資訊室。";

  return Response.json({ success: false, message }, { status });
}

export function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
