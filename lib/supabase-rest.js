const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertSupabaseEnv() {
  if (!SUPABASE_URL) throw new Error("缺少 SUPABASE_URL");
  if (!SUPABASE_KEY) throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY");
}

export async function supabaseRequest(table, query = "select=*", options = {}) {
  assertSupabaseEnv();
  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${table}?${query}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
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
  const raw = error && error.message ? error.message : String(error || "未知錯誤");
  const message = raw.includes("Could not find the table")
    ? "Supabase 資料表尚未建立，請先執行專案內的 SQL 建表。"
    : raw;
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
